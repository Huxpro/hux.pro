"use client";

import { dismissToast, showCustomToast, toast } from "@/components/ui/system-sonner";
import { GLASS_PANEL } from "@/lib/glass";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { LocateFixed, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { formatLocationLabel } from "../lib/location";
import { shouldOfferLocation } from "../lib/location-offer";
import { useAmbientTime, useLocation, useWeather } from "../provider";

// ---------------------------------------------------------------------------
// LocationOffer — the site asks for the real location, once, unprompted.
//
// The policy (who is offered, and the back-off) is lib/location-offer.ts; this
// is when and how. On the home screen, a few seconds after a network-guessed
// forecast has painted, a notice names the city it guessed and carries the
// button: one tap raises the browser's prompt, because the notice has already
// said what it is for — the full primer would only be a second screen saying
// it again. Closing it, or letting it time out, is a decline, and the offer
// backs off. At most once a session, so a reload is not another ask.
//
// A refusal opens the primer, which is where the way back is explained.
// ---------------------------------------------------------------------------

const TOAST_ID = "location-offer";
/** After the forecast paints: let the page land before anything else moves. */
const DELAY_MS = 4_000;
const DURATION_MS = 15_000;
const RESULT_MS = 3_000;
const SHOWN_KEY = "hux_location_offer_shown";

function shownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function markShown() {
  try {
    sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    // A session that cannot remember just means the offer may come back on
    // reload; the persisted back-off still holds.
  }
}

export function LocationOffer() {
  const { locale } = useLocale();
  const isHome = usePathname() === "/";
  const {
    location,
    permission,
    locationOffer,
    declineLocationOffer,
    requestAccurateLocation,
    openLocationPrimer,
  } = useLocation();
  const { weather } = useWeather();
  const { realNowMs } = useAmbientTime();

  const eligible =
    isHome &&
    !!weather &&
    shouldOfferLocation({ location, permission, offer: locationOffer, nowMs: realNowMs });
  const city = location ? formatLocationLabel(location) : null;
  const doubtful = location?.timezoneMismatch === true;

  // The handlers the notice calls, current as of the last render.
  const actionsRef = useRef({ declineLocationOffer, requestAccurateLocation, openLocationPrimer, locale });
  useEffect(() => {
    actionsRef.current = { declineLocationOffer, requestAccurateLocation, openLocationPrimer, locale };
  });
  const showingRef = useRef(false);

  useEffect(() => {
    if (!eligible) {
      // Answered elsewhere (the palette, the widget, site settings): the notice
      // has nothing left to ask.
      if (showingRef.current) {
        showingRef.current = false;
        dismissToast(TOAST_ID);
      }
      return;
    }
    if (shownThisSession()) return;

    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible" || shownThisSession()) return;
      markShown();
      showingRef.current = true;
      // Whether the notice left because it was answered, which is not a decline.
      let answered = false;
      const decline = () => {
        if (answered || !showingRef.current) return;
        showingRef.current = false;
        actionsRef.current.declineLocationOffer();
      };
      const accept = async () => {
        answered = true;
        showingRef.current = false;
        dismissToast(TOAST_ID);
        const { requestAccurateLocation, openLocationPrimer, locale } = actionsRef.current;
        const outcome = await requestAccurateLocation();
        if (outcome === "denied") {
          openLocationPrimer();
          return;
        }
        showCustomToast(
          <LocationResultToast
            text={t(
              locale,
              outcome === "granted" ? "locationPrimerGranted" : "locationPrimerUnavailable"
            )}
          />,
          { id: TOAST_ID, duration: RESULT_MS }
        );
      };
      toast.custom(
        () => (
          <LocationOfferToast
            city={city}
            doubtful={doubtful}
            onAccept={() => void accept()}
            onClose={() => {
              decline();
              dismissToast(TOAST_ID);
            }}
          />
        ),
        {
          id: TOAST_ID,
          duration: DURATION_MS,
          onAutoClose: decline,
          onDismiss: decline,
        }
      );
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [eligible, city, doubtful]);

  return null;
}

function LocationOfferToast({
  city,
  doubtful,
  onAccept,
  onClose,
}: {
  city: string | null;
  doubtful: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const text = city
    ? t(locale, doubtful ? "locationOfferDoubtful" : "locationOfferCity").replace("{city}", city)
    : t(locale, "locationOffer");

  return (
    <div
      role="status"
      className={cn(
        GLASS_PANEL,
        // Content-sized, like the sun-switch pill: the toaster's column is
        // 356px, and centring lets the notice overflow it evenly.
        "flex w-max max-w-[min(600px,calc(100vw-32px))] flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl py-2 pl-4 pr-2 shadow-raised",
        "animate-in slide-in-from-bottom-2 fade-in duration-200"
      )}
    >
      <LocateFixed className="order-1 size-4 shrink-0 text-muted-foreground" />
      <span className={cn(TYPE.body, "order-2 min-w-0 flex-1 text-secondary-foreground")}>
        {text}
      </span>
      {/* On a phone the button takes a row of its own under the sentence;
          from `sm` it sits inline, before the close. */}
      <button
        type="button"
        onClick={onAccept}
        className="order-4 w-full shrink-0 whitespace-nowrap rounded-full bg-foreground px-3 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 sm:order-3 sm:w-auto sm:py-1.5"
      >
        {t(locale, "locationPrimerConfirm")}
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t(locale, "locationPrimerDismiss")}
        className="order-3 shrink-0 rounded-full p-1.5 text-tertiary-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground sm:order-4"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function LocationResultToast({ text }: { text: string }) {
  return (
    <div
      role="status"
      className={cn(
        GLASS_PANEL,
        "inline-flex items-center gap-3 rounded-full px-4 py-3 shadow-raised",
        "animate-in slide-in-from-bottom-2 fade-in duration-200"
      )}
    >
      <LocateFixed className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn(TYPE.body, "text-foreground")}>{text}</span>
    </div>
  );
}

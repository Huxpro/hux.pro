"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { BadgeLink } from "@/components/badge-link";
import { useLocale } from "@/services";
import { useCommand } from "@/systems/command/provider";
import { useAbout } from "./provider";
import { EdgeGlow } from "./edge-glow";
import "./about.css";

export function AboutSurface() {
  const { isOpen, close } = useAbout();
  const { locale } = useLocale();
  const command = useCommand();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const zh = locale === "zh";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    const previous = document.activeElement;
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>("#about-title")
      ?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [isOpen]);

  // Remove the modal's inertness before the destination surface takes focus.
  const launch = () => flushSync(close);
  return (
    <dialog
      ref={dialogRef}
      className="about-surface"
      aria-labelledby="about-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else if (
          event.key === "/" ||
          ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")
        ) {
          event.preventDefault();
          event.stopPropagation();
          flushSync(close);
          command.open(event.key === "/");
        }
      }}
    >
      {isOpen && (
        <>
          <EdgeGlow />
          <button
            className="about-close pressable"
            onClick={close}
            aria-label={zh ? "关闭关于" : "Close About"}
          >
            <X size={18} />
          </button>
          <div className="about-scroll">
            <article className="about-copy" lang={locale}>
              <p className="about-eyebrow">
                HUX.PRO <span>/</span> {zh ? "关于这个小世界" : "A PERSONAL OS"}
              </p>
              <h1 id="about-title" tabIndex={-1}>
                {zh ? "你好，我是黄玄。" : "Hey, I’m Hux."}
              </h1>
              <div className="about-narrative">
                <p>
                  {zh ? (
                    <>
                      一名喜欢设计的工程师，关心界面，以及创造界面的人。现在在字节跳动做{" "}
                      <BadgeLink appId="lynx" onLaunch={launch} />
                      ，此前在 Meta 参与创立{" "}
                      <BadgeLink
                        href="https://react.dev/learn/react-compiler"
                        icon="/app-icons/react.png"
                        onLaunch={launch}
                      >
                        React Forget
                      </BadgeLink>
                      ，并将{" "}
                      <BadgeLink
                        href="https://hermesengine.dev"
                        onLaunch={launch}
                      >
                        Hermes
                      </BadgeLink>{" "}
                      带到 iOS。
                    </>
                  ) : (
                    <>
                      I’m an engineer drawn to design, interfaces, and the tools
                      we build them with. I’m the architect of{" "}
                      <BadgeLink appId="lynx" onLaunch={launch} /> at ByteDance.
                      Before that, I co-founded{" "}
                      <BadgeLink
                        href="https://react.dev/learn/react-compiler"
                        icon="/app-icons/react.png"
                        onLaunch={launch}
                      >
                        React Forget
                      </BadgeLink>{" "}
                      and brought{" "}
                      <BadgeLink
                        href="https://hermesengine.dev"
                        onLaunch={launch}
                      >
                        Hermes
                      </BadgeLink>{" "}
                      to iOS at Meta.
                    </>
                  )}
                </p>
                <p>
                  {zh ? (
                    <>
                      这里是我的个人「操作系统」实验：把文字、作品和好奇心放进一个可以探索的小世界。读一篇文章，打开一个应用，或听一场演讲。随意逛逛。
                    </>
                  ) : (
                    <>
                      This is my experiment in a personal{" "}
                      <em>operating system</em> — a home for my writing, work,
                      and curiosities. Read a little, open an app, or settle in
                      for a talk. Make yourself at home.
                    </>
                  )}
                </p>
              </div>
              <div className="about-actions">
                <button className="about-enter pressable" onClick={close}>
                  {zh ? "进来看看" : "Come on in"}
                  <ArrowRight size={16} />
                </button>
                <span className="about-shortcut">
                  {zh ? "随时按" : "Find me here with"} <kbd>O</kbd>
                </span>
              </div>
              <footer className="about-credits">
                {zh ? "灵感来自" : "With inspiration from"}{" "}
                <a
                  href="https://www.apple.com/apple-intelligence/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Siri
                </a>
                ,{" "}
                <a href="https://shud.in" target="_blank" rel="noreferrer">
                  Shu Ding
                </a>{" "}
                &amp;{" "}
                <a href="https://antfu.me" target="_blank" rel="noreferrer">
                  Anthony Fu
                </a>
                .
              </footer>
            </article>
          </div>
        </>
      )}
    </dialog>
  );
}

"use client";

import { SurfaceBody } from "@/systems/surface";
import type { ReactNode } from "react";
import { DevtoolFooter, DevtoolModules, DevtoolTitle } from "./panel";

export default function DevtoolPanelBody({
  closeLabel,
  onClose,
  actions,
}: {
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
}) {
  return (
    <SurfaceBody
      title={<DevtoolTitle />}
      closeLabel={closeLabel}
      onClose={onClose}
      contentClassName="pb-0"
      footer={<DevtoolFooter />}
      actions={actions}
    >
      <DevtoolModules />
    </SurfaceBody>
  );
}

import * as React from "react";

declare module "react" {
  export interface ViewTransitionProps {
    name?: string;
    children: React.ReactNode;
  }

  export const ViewTransition: React.FC<ViewTransitionProps>;

  export function addTransitionType(type: string): void;
}

export type AppWindowId = string;

export interface OpenAppWindow {
  /** Unique instance id (allows reopening same app later as a new window) */
  instanceId: AppWindowId;
  /** Registry app id */
  appId: string;
  zIndex: number;
  minimized: boolean;
  /** Cascaded origin offset from viewport center */
  offset: { x: number; y: number };
}

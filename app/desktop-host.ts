type HostMessage = {
  type: 'backup-status' | 'export-result' | 'report-folder' | 'backup-folder' | 'entry-draft';
  state?: 'saved' | 'canceled' | 'failed';
  at?: string;
  path?: string;
  error?: string;
  json?: boolean;
  revision?: number;
  draft?: string;
};
type DesktopWindow = Window & {chrome?: {webview?: {
  postMessage: (message: string) => void;
  addEventListener: (name: 'message', handler: (event: MessageEvent<HostMessage>) => void) => void;
  removeEventListener: (name: 'message', handler: (event: MessageEvent<HostMessage>) => void) => void;
}}};

export const desktopHost = () => (window as DesktopWindow).chrome?.webview;

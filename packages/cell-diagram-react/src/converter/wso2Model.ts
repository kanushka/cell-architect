export interface Wso2Gateway {
  isExposed?: boolean;
  tooltip?: string;
  observations?: unknown[];
}

export interface Wso2Service {
  id: string;
  label?: string;
  type?: string;
  dependencyIds?: string[];
  deploymentMetadata?: {
    gateways?: { internet?: Wso2Gateway; intranet?: Wso2Gateway };
  };
}

export interface Wso2Connection {
  id: string;
  label?: string;
  type?: string;
  onPlatform?: boolean;
  observationOnly?: boolean;
  observations?: unknown[];
}

export interface Wso2Component {
  id: string;
  label?: string;
  version?: string;
  type?: string;
  services?: Record<string, Wso2Service>;
  connections?: Wso2Connection[];
}

export interface Wso2CellModel {
  id: string;
  name?: string;
  components?: Wso2Component[];
  modelVersion?: string;
}

export interface Wso2ConvertOptions {
  /** Emit a top-level `title <name>` line from the model name. Default false. */
  title?: boolean;
}

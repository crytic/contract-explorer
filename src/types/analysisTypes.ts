import { Position } from "vscode";

/*
Data structure which represents parameters used to set compilation targets
*/
export interface AnalysisRequestParams {
  uris?: string[];
}

export interface SliceParams {
  uri: string;
  position: Position;
  forward: boolean;
}

// New types for interval analysis
export interface LocationInfo {
  line: number;
  column: number;
  end_line: number;
  end_column: number;
}

export interface IntervalRangeResult {
  lower_bound: string;
  upper_bound: string;
}

export interface SingleValuesResult {
  values: string[];
}

export interface VariableResult {
  name: string;
  canonical_name: string;
  display_name: string;
  interval_ranges: IntervalRangeResult[];
  valid_values: SingleValuesResult;
  invalid_values: SingleValuesResult;
  has_overflow: boolean;
  has_underflow: boolean;
  var_type?: string;
  location?: LocationInfo;
}

export interface NodeResult {
  expression: string;
  node_id: number;
  node_type: string;
  location?: LocationInfo;
  variables: VariableResult[];
}

export interface FunctionResult {
  name: string;
  nodes: NodeResult[];
}

export interface IntervalAnalysisResult {
  file_path: string;
  timestamp: string;
  functions: FunctionResult[];
}

export interface IntervalAnalysisParams {
  uri: string;
}
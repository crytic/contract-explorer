import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface SlitherCommandOutput {
    success : boolean;
    error : string | null | undefined;
    results : SlitherCommandResults | undefined;
}

export interface SlitherCommandResults {
    detectors : SlitherDetectorResult[] | undefined;
}


export interface SlitherDetector {
    index : number;
    check : string;
    title : string;
    impact : string;
    confidence : string;
    wiki_url : string;
    description : string;
    exploit_scenario : string;
    recommendation : string;
}

export interface SlitherDetectorResult {
    check : string;
    confidence : string;
    impact : string;
    description : string;
    elements : SlitherDetectorResultElement[];
    additional_fields : any | undefined;

    _ext_in_sync : boolean | undefined; // Extension: Used to check if source mappings are still valid.
}

export interface SlitherDetectorResultElement { 
    name : string;
    source_mapping : SlitherSourceMapping;
    type : string;
    type_specific_fields : SlitherTypeSpecificFields | undefined;
    additional_fields : any | undefined;
}

export interface SlitherTypeSpecificFields {
    parent : SlitherDetectorResultElement | undefined;
}

export interface SlitherSourceMapping { 
    start : number;
    length : number;
    filename_absolute : string;
    filename_relative : string;
    filename_short : string;
    filename_used : string;
    lines : number[];
    starting_column : number;
    ending_column : number;

    _ext_source_hash : string | undefined; // Extension: Hash of mapped source code.
}
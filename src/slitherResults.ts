export interface SlitherDetector {
    check : string;
    confidence : string;
    impact : string;
    title : string;
    description : string;
}

export interface SlitherResult {
    check : string;
    confidence : string;
    impact : string;
    description : string;
    elements : SlitherResultElement[];
}

export interface SlitherResultElement { 
    name : string;
    source_mapping : SlitherSourceMapping;
    type : string;
}

export interface SlitherSourceMapping { 
    start : number;
    length : number;
    filename : string;
    lines : number[];
    starting_column : number;
    ending_column : number;
}

export function getSanitizedDescription(result : SlitherResult) : string {
    // Remove all filenames in brackets from the description
    return result.description.replace(new RegExp(/\s{0,1}\(\S*\.sol(?:\#\d+\-\d+|\#\d+){0,1}\)/, 'gi'), "").replace("\r\n","\n");
}
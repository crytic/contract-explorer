export interface SlitherResult {
    check : string;
    confidence : string;
    impact : string;
    description : string;
    elements : SlitherResultElements[];
}

export interface SlitherResultElements { 
    name : string;
    source_mapping : SlitherSourceMapping;
    type : string;
}

export interface SlitherSourceMapping { 
    start : number;
    length : number;
    filename : string;
    lines : number[];
}
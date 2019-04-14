import config from "./config";
import chalk from "chalk";
import * as util from "util";

export const { slitherVersion } = config;
export const exec = util.promisify(require("child_process").exec);

// const isValid = (obj) => !isEmpty(obj) && !isUndefined(obj) && !isNull(obj)
export const logInfo = (message: string) => console.log(chalk.greenBright(message));
export const logError = (message: string) => console.log(chalk.redBright(message));

export const compareSlitherVersion = ([majorVesion, minorVersion, patch]: any) => (
                                            (majorVesion > slitherVersion.majorVersion)
                                            ||
                                            (majorVesion === slitherVersion.majorVersion &&
                                                minorVersion > slitherVersion.minorVersion
                                            ) 
                                            || 
                                            (
                                                majorVesion === slitherVersion.majorVersion &&
                                                minorVersion === slitherVersion.minorVersion &&
                                                patch >= slitherVersion.patch
                                            )
);


export const checkSlitherVersion = async () => {
    try {
        let { stdout } = await exec(`slither --version`);
        let version:[] = (stdout.replace(/\r?\n|\r/g, "")
                        .split('.'))
                        .map( 
                            (item: string) => parseInt(item) 
                        );
        let checkVersion = compareSlitherVersion(version);
        if(!checkVersion){
            logError(
                `
                    Slither Version required >= ${slitherVersion.majorVersion}.${slitherVersion.minorVersion}.${slitherVersion.patch}\n
                    Version Present: ${version.join(".")} \n
                    Please upgrade your slither "pip install slither-analyzer --upgrade"
                `
            );
            return false;
        }
    } catch(e){
        logError(
            `
                Slither Installation Required
                Please install slither ${chalk.greenBright("pip install slither-analyzer")}
            `
        );
        
        return false;
    }
    return true;
}


export const validateDetectors = async(input: []) => {
    let err;
    const cmd       = `slither --list-detectors-json`;
    let { stdout }  = await exec(cmd).catch((e: any)=>err=e);
    if(err) console.log({err})
    let detectors   = (JSON.parse(stdout)).map((item: any) => item['check']);
    let difference  = input.filter(x => !detectors.includes(x));
    
    return difference.length === 0;
}

export const getDetectors = async() => {
    let err;
    const cmd       = `slither --list-detectors-json`;
    let { stdout }  = await exec(cmd).catch((e: any) => err = e);
    if(err) console.log({err})
    return JSON.parse(stdout);
}


export const sortError = (error: []) => {
    const order: any = {
      "Informational": 0,
      "Low": 1,
      "Medium": 2,
      "High": 3,
    }
  
    return error.sort(function(x: any, y: any) {
      if(order[x.impact] < order[y.impact]){
        return -1
      } else if (order[x.impact] > order[y.impact]) {
        return 1
      }
      return 0
    })
  }
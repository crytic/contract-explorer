import config from "./config";
import chalk from "chalk";
import * as util from "util";

const { slitherVersion } = config;
const exec = util.promisify(require("child_process").exec);

// const isValid = (obj) => !isEmpty(obj) && !isUndefined(obj) && !isNull(obj)
const logInfo = (message: string) => console.log(chalk.greenBright(message));
const logError = (message: string) => console.log(chalk.redBright(message));

const compareSlitherVersion = ({majorVesion, minorVersion, patch }: any) => (
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


const checkSlitherVersion = async () => {
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


const validateDetectors = async(input: string) => {
    let err;
    const cmd       = `slither --list-detectors-json`;
    let { stdout }  = await exec(cmd).catch((e: any)=>err=e);
    if(err) console.log({err})
    let detectors   = (JSON.parse(stdout)).map((item: any) => item['check']);
    let user_input  = input.split(",");
    let difference  = user_input.filter(x => !detectors.includes(x));
    
    return difference.length === 0;
}

const getDetectors = async() => {
    let err;
    const cmd       = `slither --list-detectors-json`;
    let { stdout }  = await exec(cmd).catch((e: any) => err = e);
    if(err) console.log({err})
    return JSON.parse(stdout);
}

export { exec, checkSlitherVersion, logInfo, logError, validateDetectors, getDetectors }
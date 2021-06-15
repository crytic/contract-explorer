import { SlitherDetector, SlitherVersionData } from './types/slitherDetectors';
import { SlitherLanguageClient } from './slitherLanguageClient'
import { Logger } from './utils/logger';

export let version : string;
export let detectors : SlitherDetector[];

export class State {
    private _initialized: boolean = false;
    public get initialized(): boolean { return this._initialized; }
    
    public versionData: SlitherVersionData | null = null;
    public detectors: SlitherDetector[] | null = null;

    constructor(public slitherLanguageClient: SlitherLanguageClient) {}

    public async initialize(): Promise<void> {
        // If we're already initialized, stop
        if(this.initialized) {
            return;
        }

        // Obtain our versions
        this.versionData = await this.slitherLanguageClient.getVersionData();

        // Obtain our detectors list
        this.detectors = await this.slitherLanguageClient.getDetectorList();

        // Set our initialized state.
        this._initialized = true;
    }

    public async reset(): Promise<void> {
        // Clear all state variables
        this.detectors = null;
        this.versionData = null;

        // Set our initialized state to false.
        this._initialized = false;
    }
}
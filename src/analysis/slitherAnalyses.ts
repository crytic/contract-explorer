import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import * as state from '../state'
import { SlitherCommandOutput, SlitherDetector, SlitherDetectorResult } from '../types/slitherTypes';
import { SlitherLanguageClient } from '../slitherLanguageClient';
import { CompilationSettings } from '../types/configTypes';
import { OnAnalysisSuccessEventArgs, OnAnalysisFailedEventArgs, SlitherAnalysis, OnAnalyzeAllProgress, } from '../types/analysisTypes';
import { Emitter, Event, ResponseError } from 'vscode-languageclient'
import { print } from 'util';

export class SlitherAnalyses {

    // Properties
    private failedAnalysesByCompilationIndex = new Map<number, ResponseError<any>>(); // compilation index -> error
    private analysesByCompilationIndex = new Map<number, SlitherAnalysis>(); // compilation index -> analysis
    private analysesByAnalysisId = new Map<number, SlitherAnalysis>(); // analysis id -> analysis

    // Events
    private _analysisSuccessEmitter = new Emitter<OnAnalysisSuccessEventArgs>();
    public onAnalysisSuccess: Event<OnAnalysisSuccessEventArgs> = this._analysisSuccessEmitter.event;
    private _analysisErrorEmitter = new Emitter<OnAnalysisFailedEventArgs>();
    public onAnalysisError: Event<OnAnalysisFailedEventArgs> = this._analysisErrorEmitter.event;
    private _analyzeAllProgressEmitter = new Emitter<OnAnalyzeAllProgress>();
    public onAnalyzeAllProgress: Event<OnAnalyzeAllProgress> = this._analyzeAllProgressEmitter.event;

    constructor(public readonly languageClient: SlitherLanguageClient) {
        // When a configuration is saved, we clear our analyses and reanalyze
        state.onSavedConfiguration(() => {
            this.analyzeAll();
        });

        // When a codebase analysis is completed, run some subsequent analyses on top.
        this.onAnalysisSuccess(async(e: OnAnalysisSuccessEventArgs) => {
            await this.runDetectors(e.analysis);
        });
        // Log any analysis failures.
        this.onAnalysisError(async(e: OnAnalysisFailedEventArgs) => {
            await Logger.error(e.error, true);
        })
    }

    private async analyze(compilationIndex: number): Promise<SlitherAnalysis | ResponseError<any>> {

        // Obtain the compilation settings
        let compilationSettings: CompilationSettings = state.configuration.compilations[compilationIndex];
    
        // Call on the language server for analysis
        let analysisId;
        let error: ResponseError<any>;
        try {
            analysisId = await this.languageClient.createAnalysis(compilationSettings);
        } catch(err) {
            error = err;
        }

        // If we have results from a previous analysis for this index, clear them.
        await this.deleteAnalysis(compilationIndex);

        // Set our new analysis id in our lookup if we have one
        if (analysisId !== undefined) {
            // Obtain our analysis and add it to our lookups.
            let analysis: SlitherAnalysis = {id: analysisId, detectorResults: []};
            this.analysesByCompilationIndex.set(compilationIndex, analysis);
            this.analysesByAnalysisId.set(analysisId, analysis);

            // Fire our event and return our success status
            this._analysisSuccessEmitter.fire({compilationIndex: compilationIndex, compilationSettings: compilationSettings, analysis: analysis});
            return analysis;
        } else {            
            // Add this to our failed analysis lookup.
            this.failedAnalysesByCompilationIndex.set(compilationIndex, error!);

            // Fire our failed event and return our success status.
            this._analysisErrorEmitter.fire({compilationIndex: compilationIndex, error: error!});

            return error!;
        }
    }

    private async deleteAnalysis(compilationIndex: number): Promise<void> {
        // If we have an existing analysis for this index, free it on our server and local maps.
        let analysisId = this.analysesByCompilationIndex.get(compilationIndex)?.id;
        if (analysisId !== undefined) {
            try {
                // Attempt to free it in our language server
                await this.languageClient.deleteAnalysis(analysisId);
            } catch {}

            // Free it from our maps
            this.analysesByCompilationIndex.delete(compilationIndex);
            this.analysesByAnalysisId.delete(analysisId);
        }

        // Clear any failed analysis under this id as well.
        this.failedAnalysesByCompilationIndex.delete(compilationIndex);
    }

    public async analyzeAll(): Promise<void> {
        // Loop through all successful analyses and delete any which don't exist anymore.
        for(let [compilationIndex, ] of this.analysesByCompilationIndex) {
            if (compilationIndex >= state.configuration.compilations.length) {
                await this.deleteAnalysis(compilationIndex);
            }
        }

        // Loop through all failed analyses and delete any which don't exist anymore.
        for(let [compilationIndex, ] of this.failedAnalysesByCompilationIndex) {
            if (compilationIndex >= state.configuration.compilations.length) {
                await this.deleteAnalysis(compilationIndex);
            }
        }

        // Now track our results
        let totalCompilations = state.configuration.compilations.length;
        let successfulCompilations = 0;
        let failedCompilations = 0;
        
        // Fire our event before we begin
        this._analyzeAllProgressEmitter.fire({totalCompilations: totalCompilations, successfulCompilations: successfulCompilations, failedCompilations});

        // Loop for each compilation index and free/reanalyze them all.
        for(let i = 0; i < state.configuration.compilations.length; i++) {
            // Determine if we succeeded.
            let result = await this.analyze(i);
            if (result instanceof ResponseError) {
                failedCompilations++;
            } else {
                successfulCompilations++;
            }
            this._analyzeAllProgressEmitter.fire({totalCompilations: totalCompilations, successfulCompilations: successfulCompilations, failedCompilations});
        }
    }

    public async runDetectors(analysis: SlitherAnalysis): Promise<void> {
        // If we are initialized and have a client
        if (state.client) {
            // Run detectors for this analysis.
            analysis.detectorResults = await state.client.runDetectors(analysis.id);
        }
    }
}
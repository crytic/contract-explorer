import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import * as state from '../state'
import { SlitherCommandOutput, SlitherDetector, SlitherDetectorResult } from '../types/slitherTypes';
import { SlitherLanguageClient } from '../slitherLanguageClient';
import { CompilationSettings } from '../types/configTypes';
import { OnAnalyzedEventArgs, SlitherAnalysis } from '../types/analysisTypes';
import { Emitter, Event } from 'vscode-languageclient'
import { print } from 'util';

export class SlitherAnalyses {
    // Properties
    private analysesByCompilationIndex = new Map<number, SlitherAnalysis>(); // compilation index -> analysis
    private analysesByAnalysisId = new Map<number, SlitherAnalysis>(); // analysis id -> analysis

    // Events
    private _analyzedEmitter = new Emitter<OnAnalyzedEventArgs>();
    public onAnalyzed: Event<OnAnalyzedEventArgs> = this._analyzedEmitter.event;

    constructor(public readonly languageClient: SlitherLanguageClient) {
        // When a configuration is saved, we clear our analyses and reanalyze
        state.onSavedConfiguration(() => {
            this.analyzeAll();
        });

        // When a codebase analysis is completed, run some subsequent analyses on top.
        this.onAnalyzed(async(e: OnAnalyzedEventArgs) => {
            await this.runDetectors(e.analysis);
        });
    }

    public async analyze(compilationIndex: number): Promise<void> {

        // Obtain the compilation settings
        let compilationSettings: CompilationSettings = state.configuration.compilations[compilationIndex];
    
        // Call on the language server for analysis
        let analysisId;
        try {
            analysisId = await this.languageClient.createAnalysis(compilationSettings);
        } catch(err) {
            Logger.error(err, true);
        }

        // If we have an existing compilation for this index, free it before registering our new one.
        await this.deleteAnalysis(compilationIndex);

        // Set our new analysis id in our lookup if we have one
        if (analysisId !== undefined) {
            // Obtain our analysis and add it to our lookups.
            let analysis: SlitherAnalysis = {id: analysisId, detectorResults: []};
            this.analysesByCompilationIndex.set(compilationIndex, analysis);
            this.analysesByAnalysisId.set(analysisId, analysis);

            // Fire our event
            this._analyzedEmitter.fire({compilationIndex: compilationIndex, compilationSettings: compilationSettings, analysis: analysis});
        }
    }

    private async deleteAnalysis(compilationIndex: number): Promise<void> {
        // If we have an existing compilation for this index, free it before registering our new one.
        let analysisId = this.analysesByCompilationIndex.get(compilationIndex)?.id;
        if (analysisId !== undefined) {
            try {
                // Attempt to free it in our language server
                await this.languageClient.deleteAnalysis(analysisId);
            } catch {}

            // Free it from our map
            this.analysesByCompilationIndex.delete(compilationIndex);
            this.analysesByAnalysisId.delete(analysisId);
        }
    }

    public async analyzeAll(): Promise<void> {
        // Loop through all keys, and unregister any compilation indexes which don't exist anymore.
        for(let [compilationIndex, analysis] of this.analysesByCompilationIndex) {
            if (compilationIndex >= state.configuration.compilations.length) {
                try {
                    // If we have an existing compilation for this index, free it before registering our new one.
                    await this.deleteAnalysis(compilationIndex);
                } catch {}
            }
        }
        
        // Loop for each compilation index and free/reanalyze them all.
        for(let i = 0; i < state.configuration.compilations.length; i++) {
            await this.analyze(i);
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
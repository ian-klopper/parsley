"use strict";
/**
 * Comprehensive Debug Logger for 3-Phase Extraction Pipeline
 * Provides detailed server console output for debugging and monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugLogger = exports.ExtractionDebugLogger = void 0;
class ExtractionDebugLogger {
    constructor() {
        this.logs = [];
        this.startTime = Date.now();
        this.phaseStartTimes = {};
    }
    formatTimestamp() {
        return new Date().toISOString();
    }
    formatDuration() {
        const duration = Date.now() - this.startTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        const ms = duration % 1000;
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    log(level, operation, details, data, phase, tokens, cost) {
        const timestamp = this.formatTimestamp();
        const duration = this.formatDuration();
        const entry = {
            timestamp,
            level,
            operation,
            details,
            data,
            phase,
            tokens,
            cost
        };
        this.logs.push(entry);
        // Enhanced console output with colors and formatting
        const phasePrefix = phase ? `[P${phase}]` : '';
        const prefix = `[${duration}] ${phasePrefix}[${level}]`;
        const message = details ? `${operation} | ${details}` : operation;
        switch (level) {
            case 'PHASE':
                console.log(`\n\x1b[94m╔═══════════════════════════════════════╗\x1b[0m`);
                console.log(`\x1b[94m║ ${message.padEnd(37, ' ')} ║\x1b[0m`);
                console.log(`\x1b[94m╚═══════════════════════════════════════╝\x1b[0m`);
                break;
            case 'API':
                console.log(`\x1b[93m${prefix} ${message}\x1b[0m`); // Yellow
                break;
            case 'TOKEN':
                console.log(`\x1b[96m${prefix} ${message}\x1b[0m`); // Cyan
                break;
            case 'BATCH':
                console.log(`\x1b[95m${prefix} ${message}\x1b[0m`); // Magenta
                break;
            case 'SUCCESS':
                console.log(`\x1b[92m${prefix} ${message}\x1b[0m`); // Green
                break;
            case 'WARN':
                console.log(`\x1b[93m${prefix} ${message}\x1b[0m`); // Yellow
                break;
            case 'ERROR':
                console.log(`\x1b[91m${prefix} ${message}\x1b[0m`); // Red
                break;
            case 'DEBUG':
                console.log(`\x1b[90m${prefix} ${message}\x1b[0m`); // Gray
                break;
            case 'COST':
                console.log(`\x1b[93m${prefix} ${message}\x1b[0m`); // Yellow
                break;
        }
        // Log structured data if provided
        if (data && level !== 'TOKEN') {
            const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            const truncated = dataStr.length > 500 ? dataStr.substring(0, 500) + '...' : dataStr;
            console.log(`\x1b[90m    Data: ${truncated}\x1b[0m`);
        }
        // Log token details
        if (tokens) {
            console.log(`\x1b[96m    Tokens: ${tokens.input} in, ${tokens.output} out${cost ? ` | Cost: $${cost.toFixed(6)}` : ''}\x1b[0m`);
        }
    }
    // Phase logging
    startPhase(phase, description) {
        this.phaseStartTimes[phase] = Date.now();
        this.log('PHASE', `PHASE ${phase} START`, description, null, phase);
    }
    endPhase(phase, description, itemCount) {
        const duration = Date.now() - (this.phaseStartTimes[phase] || Date.now());
        const durationStr = `${(duration / 1000).toFixed(2)}s`;
        const details = itemCount ? `${description} | ${itemCount} items | ${durationStr}` : `${description} | ${durationStr}`;
        this.log('PHASE', `PHASE ${phase} COMPLETE`, details, null, phase);
    }
    // Document processing
    documentStart(phase, docIndex, total, filename, type) {
        this.log('DEBUG', 'DOCUMENT_START', `${docIndex}/${total}: ${filename} (${type})`, null, phase);
    }
    documentComplete(phase, filename, itemsExtracted, pagesProcessed) {
        const details = itemsExtracted !== undefined
            ? `${filename} | ${itemsExtracted} items${pagesProcessed ? `, ${pagesProcessed} pages` : ''}`
            : filename;
        this.log('SUCCESS', 'DOCUMENT_COMPLETE', details, null, phase);
    }
    // Batch processing
    batchStart(phase, batchIndex, totalBatches, tokens, model) {
        this.log('BATCH', 'BATCH_START', `${batchIndex}/${totalBatches} | ${tokens} tokens | ${model}`, null, phase);
    }
    batchComplete(phase, batchIndex, itemsExtracted, responseTime) {
        this.log('BATCH', 'BATCH_COMPLETE', `Batch ${batchIndex} | ${itemsExtracted} items | ${responseTime}ms`, null, phase);
    }
    // API calls
    apiCallStart(phase, callIndex, model, estimatedTokens) {
        this.log('API', 'API_CALL_START', `Call #${callIndex} | ${model}${estimatedTokens ? ` | ~${estimatedTokens} tokens` : ''}`, null, phase);
    }
    apiCallComplete(phase, callIndex, model, inputTokens, outputTokens, responseTime, cost) {
        this.log('API', 'API_CALL_COMPLETE', `Call #${callIndex} | ${model} | ${responseTime}ms`, null, phase, { input: inputTokens, output: outputTokens }, cost);
    }
    apiCallError(phase, callIndex, model, error) {
        this.log('ERROR', 'API_CALL_FAILED', `Call #${callIndex} | ${model} | ${error}`, null, phase);
    }
    // Token tracking
    tokenUsage(phase, operation, inputTokens, outputTokens, cost) {
        this.log('TOKEN', 'TOKEN_USAGE', operation, null, phase, { input: inputTokens, output: outputTokens }, cost);
    }
    // Cost tracking
    phaseCost(phase, description, cost, apiCalls) {
        this.log('COST', 'PHASE_COST', `${description} | ${apiCalls} calls | $${cost.toFixed(6)}`, null, phase);
    }
    totalCost(totalCost, totalCalls, totalTokens) {
        this.log('COST', 'TOTAL_COST', `$${totalCost.toFixed(6)} | ${totalCalls} calls | ${totalTokens.input + totalTokens.output} tokens`);
    }
    // General logging methods
    debug(phase, operation, details, data) {
        this.log('DEBUG', operation, details, data, phase);
    }
    success(phase, operation, details, data) {
        this.log('SUCCESS', operation, details, data, phase);
    }
    warn(phase, operation, details, data) {
        this.log('WARN', operation, details, data, phase);
    }
    error(phase, operation, details, data) {
        this.log('ERROR', operation, details, data, phase);
    }
    // Special formatted summaries
    extractionStart(documentCount, estimatedCost) {
        console.log('\n\x1b[94m╔═══════════════════════════════════════╗\x1b[0m');
        console.log('\x1b[94m║       3-PHASE EXTRACTION STARTING     ║\x1b[0m');
        console.log('\x1b[94m╠═══════════════════════════════════════╣\x1b[0m');
        console.log(`\x1b[94m║ Documents: ${documentCount.toString().padStart(4, ' ')}                        ║\x1b[0m`);
        console.log(`\x1b[94m║ Est. Cost: $${estimatedCost.toFixed(4).padStart(7, ' ')}                   ║\x1b[0m`);
        console.log('\x1b[94m╚═══════════════════════════════════════╝\x1b[0m');
    }
    extractionComplete(totalCost, itemCount, documentCount, processingTime, phaseBreakdown) {
        const minutes = Math.floor(processingTime / 60000);
        const seconds = Math.floor((processingTime % 60000) / 1000);
        const costPerItem = itemCount > 0 ? totalCost / itemCount : 0;
        console.log('\n\x1b[92m🎉 3-PHASE EXTRACTION COMPLETE 🎉\x1b[0m');
        console.log('\x1b[92m╔═══════════════════════════════════════╗\x1b[0m');
        console.log('\x1b[92m║           FINAL COST REPORT           ║\x1b[0m');
        console.log('\x1b[92m╠═══════════════════════════════════════╣\x1b[0m');
        console.log(`\x1b[92m║ Documents processed: ${documentCount.toString().padStart(4, ' ')}             ║\x1b[0m`);
        console.log(`\x1b[92m║ Total items extracted: ${itemCount.toString().padStart(6, ' ')}         ║\x1b[0m`);
        console.log('\x1b[92m║                                       ║\x1b[0m');
        console.log(`\x1b[92m║ Phase 1 (Structure): $${phaseBreakdown.phase1.toFixed(4).padStart(7, ' ')}         ║\x1b[0m`);
        console.log(`\x1b[92m║ Phase 2 (Extract):   $${phaseBreakdown.phase2.toFixed(4).padStart(7, ' ')}         ║\x1b[0m`);
        console.log(`\x1b[92m║ Phase 3 (Enrich):    $${phaseBreakdown.phase3.toFixed(4).padStart(7, ' ')}         ║\x1b[0m`);
        console.log('\x1b[92m║                                       ║\x1b[0m');
        console.log(`\x1b[92m║ 💰 TOTAL COST: $${totalCost.toFixed(6).padStart(10, ' ')}            ║\x1b[0m`);
        console.log(`\x1b[92m║ 📊 Cost per item: $${costPerItem.toFixed(4).padStart(7, ' ')}            ║\x1b[0m`);
        console.log(`\x1b[92m║ ⏱️  Processing time: ${minutes}:${seconds.toString().padStart(2, '0')} minutes        ║\x1b[0m`);
        console.log('\x1b[92m╚═══════════════════════════════════════╝\x1b[0m');
    }
    extractionError(error, totalCost, itemsExtracted, phase) {
        console.log('\n\x1b[91m!!! 3-PHASE EXTRACTION FAILED !!!\x1b[0m');
        console.log('\x1b[91m╔═══════════════════════════════════════╗\x1b[0m');
        console.log('\x1b[91m║              ERROR REPORT             ║\x1b[0m');
        console.log('\x1b[91m╠═══════════════════════════════════════╣\x1b[0m');
        console.log(`\x1b[91m║ Failed in Phase: ${phase.toString().padStart(1, ' ')}                   ║\x1b[0m`);
        console.log(`\x1b[91m║ Items extracted: ${itemsExtracted.toString().padStart(6, ' ')}              ║\x1b[0m`);
        console.log(`\x1b[91m║ Cost incurred: $${totalCost.toFixed(6).padStart(9, ' ')}              ║\x1b[0m`);
        console.log('\x1b[91m║                                       ║\x1b[0m');
        console.log('\x1b[91m║ Error: Check logs for details         ║\x1b[0m');
        console.log('\x1b[91m╚═══════════════════════════════════════╝\x1b[0m');
        this.error(phase, 'EXTRACTION_FAILED', error.message, { stack: error.stack });
    }
    // Memory usage tracking
    logMemoryUsage(operation, phase) {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const memory = process.memoryUsage();
            const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
            this.debug(phase || 0, 'MEMORY_USAGE', `${operation}: ${memoryMB} MB`);
        }
    }
    // Export logs
    exportLogs() {
        return [...this.logs];
    }
    exportLogsAsText() {
        return this.logs.map(log => {
            const phasePrefix = log.phase ? `[P${log.phase}]` : '';
            const data = log.data ? ` | ${JSON.stringify(log.data)}` : '';
            const tokens = log.tokens ? ` | ${log.tokens.input}/${log.tokens.output} tokens` : '';
            const cost = log.cost ? ` | $${log.cost.toFixed(6)}` : '';
            return `${log.timestamp} ${phasePrefix}[${log.level}] ${log.operation} | ${log.details || ''}${tokens}${cost}${data}`;
        }).join('\n');
    }
    // Clear logs (for testing)
    clearLogs() {
        this.logs = [];
        this.startTime = Date.now();
        this.phaseStartTimes = {};
    }
}
exports.ExtractionDebugLogger = ExtractionDebugLogger;
// Global logger instance
exports.debugLogger = new ExtractionDebugLogger();

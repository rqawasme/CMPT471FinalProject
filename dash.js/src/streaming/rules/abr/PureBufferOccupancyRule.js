import SwitchRequest from '../SwitchRequest';
import AbrController from '../../controllers/AbrController';
import FactoryMaker from '../../../core/FactoryMaker';
import Debug from '../../../core/Debug';
import MetricsConstants from '../../constants/MetricsConstants';


function PureBufferOccupancyRule(config){
    config = config || {};

    console.log("I AM HHHHHHHHHHHEEEEEEEEEEEEEEEEEEEEEEEERRRRRRRRRRRRRRRREEEEEEEE");

    let instance;  //returned object
    let logger;    //Debug tool as specified inside other rules
    let prevStreamTime; 

    const MIN_BUFFER_LEN = 10000;
    const MAX_BUFFER_LEN = 500000;

    const context = this.context;
    const dashMetrics = config.dashMetrics;


    function setup(){
        logger = Debug(context).getInstance().getLogger(instance);
        prevStreamTime = 0;
    }

    function execute(rulesContext, callback){
        console.log("HMMMMMMMMMMMMMMMMMMM");
        //necessary info
        let current = rulesContext.getCurrentValue();
        let streamProcessor = rulesContext.getStreamProcessor();

        let trackInfo = rulesContext.getTrackInfo();
        let waitToSwitchTime = !isNaN(trackInfo.fragmentDuration) ? trackInfo.fragmentDuration / 2 : 2;

        let mediaInfo = rulesContext.getMediaInfo();
        let mediaType = mediaInfo.type;
        let maxIndex = mediaInfo.representationCount - 1;

        let abrController = streamProcessor.getABRController();

        let ifBufferRich = false;
        let ifBuffOverRich = false;
        let switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.WEAK, {name: PureBufferOccupancyRule.__dashjs_factory_name});


        const useBufferOccupancyABR = rulesContext.useBufferOccupancyABR();

        // get b(t)
        let lastBufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        let lastBufferState = (metrics.BufferState.length > 0) ? metrics.BufferState[metrics.BufferState.length - 1] : null;

        let t = new Date().getTime() / 1000; //current time
        if(t - prevStreamTime < waitToSwitchTime || abrController.getAbandonmentStateFor(mediaType) == AbrController.ABANDON_LOAD || !useBufferOccupancyABR){
            callback(switchRequest);
            return;
        }

        if(lastBufferState != null){
            if(lastBufferLevel > lastBufferState.target){

                // decrease the video quality when buffer length < MIN_LEN
                if(lastBufferLevel < MIN_BUFFER_LEN){
                    ifBufferRich = false;
                }
                // increase the quality as buffer length increases
                else if(lastBufferLevel >= MIN_BUFFER_LEN && lastBufferLevel < MAX_BUFFER_LEN)
                {
                    ifBufferRich = true;
                }
                // keep in best quality if buffer lengh >= MAX_LEN
                else if(lastBufferLevel >= MAX_BUFFER_LEN)
                {
                    ifBufferRich = true;
                    ifBuffOverRich = true;
                }


                if(maxIndex > 0){
                    if(ifBufferRich && ifBuffOverRich){
                        //best quality
                        const maxQuality = abrRulesCollection.getMaxQuality(rulesContext).quality;
                        switchRequest.quality = maxQuality;
                    }else if(!ifBufferRich && !ifBuffOverRich){
                        //lowest quality
                        switchRequest.quality = 0;
                    }else if(ifBufferRich && !ifBuffOverRich){
                        //calculate quality dynamically
                        const throughputHistory = abrController.getThroughputHistory();
                        const throughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);
                        const latency = throughputHistory.getAverageLatency(mediaType);
                        switchRequest.quality = abrController.getQualityForBitrate(mediaInfo, throughput, latency);
                    }
                    switchRequest.value = maxIndex;
                    switchRequest.priority = SwitchRequest.STRONG;
                    switchRequest.reason.bufferLevel = lastBufferLevel;
                    switchRequest.reason.bufferTarget = lastBufferState.target;         
                }
            }
        }
        
        if(switchRequest.value !== SwitchRequest.NO_CHANGE && switchRequest.value !== current) {
                log('BufferOccupancyRule requesting switch to index: ', switchRequest.value, 'type: ',mediaType, ' Priority: ',
                    switchRequest.priority === SwitchRequest.DEFAULT ? 'Default' :
                        switchRequest.priority === SwitchRequest.STRONG ? 'Strong' : 'Weak');
        }  
        callback(switchRequest);
    }

    // copied from throughput
    function getMaxIndex(rulesContext) {
        const switchRequest = SwitchRequest(context).create();

        if (!rulesContext || !rulesContext.hasOwnProperty('getMediaInfo') || !rulesContext.hasOwnProperty('getMediaType') || !rulesContext.hasOwnProperty('useBufferOccupancyABR') ||
            !rulesContext.hasOwnProperty('getAbrController') || !rulesContext.hasOwnProperty('getScheduleController')) {
            return switchRequest;
        }

        checkConfig();

        const mediaInfo = rulesContext.getMediaInfo();
        const mediaType = rulesContext.getMediaType();
        const currentBufferState = dashMetrics.getCurrentBufferState(mediaType);
        const scheduleController = rulesContext.getScheduleController();
        const abrController = rulesContext.getAbrController();
        const streamInfo = rulesContext.getStreamInfo();
        const isDynamic = streamInfo && streamInfo.manifestInfo ? streamInfo.manifestInfo.isDynamic : null;
        const throughputHistory = abrController.getThroughputHistory();
        const throughput = throughputHistory.getSafeAverageThroughput(mediaType, isDynamic);
        const latency = throughputHistory.getAverageLatency(mediaType);
        const useBufferOccupancyABR = rulesContext.useBufferOccupancyABR();


        if (isNaN(throughput) || !currentBufferState || useBufferOccupancyABR) {
            return switchRequest;
        }

        if (abrController.getAbandonmentStateFor(mediaType) !== MetricsConstants.ABANDON_LOAD) {
            if (currentBufferState.state === MetricsConstants.BUFFER_LOADED || isDynamic) {
                switchRequest.quality = abrController.getQualityForBitrate(mediaInfo, throughput, latency);
                scheduleController.setTimeToLoadDelay(0);
                logger.debug('[' + mediaType + '] requesting switch to index: ', switchRequest.quality, 'Average throughput', Math.round(throughput), 'kbps');
                switchRequest.reason = {throughput: throughput, latency: latency};
            }
        }

        return switchRequest;
    }
    // also copied
    function checkConfig() {
        if (!dashMetrics || !dashMetrics.hasOwnProperty('getCurrentBufferState')) {
            throw new Error(Constants.MISSING_CONFIG_ERROR);
        }
    }

    instance = {        
        getMaxIndex: getMaxIndex,
        execute: execute
    };

    setup();
    return instance;
}

PureBufferOccupancyRule.__dashjs_factory_name = 'PureBufferOccupancyRule';
export default FactoryMaker.getClassFactory(PureBufferOccupancyRule);
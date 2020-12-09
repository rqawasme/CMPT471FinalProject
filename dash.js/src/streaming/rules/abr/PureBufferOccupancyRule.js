import SwitchRequest from '../SwitchRequest';
import AbrController from '../../controllers/AbrController';
import FactoryMaker from '../../../core/FactoryMaker';
import Debug from '../../../core/Debug';
// import ABRRulesCollection from './ABRRulesCollection';

function PureBufferOccupancyRule(config) {
    config = config || {};

    let instance;  //returned object
    let logger;    //Debug tool as specified inside other rules
    let prevStreamTime;

    const MIN_BUFFER_LEN = 10;
    const MAX_BUFFER_LEN = 50;

    const context = this.context;
    const dashMetrics = config.dashMetrics;


    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        prevStreamTime = 0;
    }

    function getMaxIndex(rulesContext) {
        //necessary info
        let representationInfo = rulesContext.getRepresentationInfo();
        let waitToSwitchTime = !isNaN(representationInfo.fragmentDuration) ? representationInfo.fragmentDuration / 2 : 2;

        let mediaInfo = rulesContext.getMediaInfo();
        let mediaType = mediaInfo.type;
        let maxIndex = mediaInfo.representationCount - 1;

        let abrController = rulesContext.getAbrController();

        let ifBufferRich = false;
        let ifBuffOverRich = false;
        let switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.WEAK, {name: PureBufferOccupancyRule.__dashjs_factory_name});


        const useBufferOccupancyABR = rulesContext.useBufferOccupancyABR();
        const streamInfo = rulesContext.getStreamInfo();
        const isDynamic = streamInfo && streamInfo.manifestInfo && streamInfo.manifestInfo.isDynamic;

        // get b(t)
        let lastBufferLevel = dashMetrics.getCurrentBufferLevel(mediaType);
        let lastBufferState = dashMetrics.getCurrentBufferState(mediaType);

        let t = new Date().getTime() / 1000; //current time
        if (t - prevStreamTime < waitToSwitchTime || abrController.getAbandonmentStateFor(mediaType) == AbrController.ABANDON_LOAD || !useBufferOccupancyABR) {
            return switchRequest;
        }

        if (lastBufferState !== null) {
            if (lastBufferLevel > lastBufferState.target) {

                // decrease the video quality when buffer length < MIN_LEN
                if (lastBufferLevel < MIN_BUFFER_LEN) {
                    ifBufferRich = false;
                }
                // increase the quality as buffer length increases
                else if (lastBufferLevel >= MIN_BUFFER_LEN && lastBufferLevel < MAX_BUFFER_LEN)
                {
                    ifBufferRich = true;
                }
                // keep in best quality if buffer lengh >= MAX_LEN
                else if (lastBufferLevel >= MAX_BUFFER_LEN)
                {
                    ifBufferRich = true;
                    ifBuffOverRich = true;
                }


                if (maxIndex > 0) {
                    if (ifBufferRich && ifBuffOverRich) {
                        //best quality
                        // let abrRulesCollection = ABRRulesCollection(context).create({
                        //     dashMetrics: dashMetrics
                        // });
                        // abrRulesCollection.initialize();
                        // const maxQuality = abrRulesCollection.getMaxQuality(rulesContext);
                        // switchRequest.quality = maxQuality;
                    }else if (!ifBufferRich && !ifBuffOverRich) {
                        //lowest quality
                        switchRequest.quality = 0;
                    }else if (ifBufferRich && !ifBuffOverRich) {
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
        // if (switchRequest.value !== SwitchRequest.NO_CHANGE && switchRequest.value !== current) {
        //     logger('BufferOccupancyRule requesting switch to index: ', switchRequest.value, 'type: ',mediaType, ' Priority: ',
        //     switchRequest.priority === SwitchRequest.DEFAULT ? 'Default' :
        //     switchRequest.priority === SwitchRequest.STRONG ? 'Strong' : 'Weak');
        // }
        return switchRequest;
    }

    instance = {
        getMaxIndex: getMaxIndex
    };

    setup();
    return instance;
}

PureBufferOccupancyRule.__dashjs_factory_name = 'PureBufferOccupancyRule';
export default FactoryMaker.getClassFactory(PureBufferOccupancyRule);
/**
 * This rule implements the first ABR algorithm proposed in 
 * A Buffer-Based Approach to Rate Adaptation: Evidence from a Large Video Streaming Service
 * source: http://web.stanford.edu/class/cs244/papers/sigcomm2014-video.pdf 
 */

import SwitchRequest from '../SwitchRequest';
import AbrController from '../../controllers/AbrController';
import FactoryMaker from '../../../core/FactoryMaker';
import Debug from '../../../core/Debug';
import MetricsModel from "../../models/MetricsModel";

function PureBufferOccupancyRule(config){
    config = config || {};
    const context = this.context;

    let instance;  //returned object
    let logger;    //Debug tool as specified inside other rules
    let prevStreamTime; 
    let metricsModel = MetricsModel(context).getInstance();
    let prevRate = 0;

    const metricsModel = config.metricsModel;
    const dashMetrics = config.dashMetrics;
    const mediaPlayerModel = config.mediaPlayerModel;

    //  the size of reservoir needs to be at least one chunk (2s in the script)
    const reservoir = 2; 
    // the buffer distance between B1 and Bm
    const cushion = 0;

    function setup(){
        logger = Debug(context).getInstance().getLogger(instance);
    }

    function defineRateMap(currentBufferLevel, step, rateMap){
        if(currentBufferLevel <= cushion+reservoir && currentBufferLevel >= reservoir){
            return rateMap[Math.round((currentBufferLevel-reservoir)/step)*step + reservoir];
        }     
        else if(currentBufferLevel > cushion + reservoir){
            return rateMap[cushion + reservoir];
        }          
        else {
            return rateMap[reservoir];
        }            
    }

    function execute(rulesContext, callback){
        //necessary info
        let current = rulesContext.getCurrentValue();
        let streamProcessor = rulesContext.getStreamProcessor();

        let trackInfo = rulesContext.getTrackInfo();
        let waitToSwitchTime = !isNaN(trackInfo.fragmentDuration) ? trackInfo.fragmentDuration / 2 : 2;

        let mediaInfo = rulesContext.getMediaInfo();
        let mediaType = mediaInfo.type;
        let maxIndex = mediaInfo.representationCount - 1;

        let abrController = streamProcessor.getABRController();
        let metrics = metricsModel.getReadOnlyMetricsFor(mediaType);

        let ifBufferRich = false;
        let switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.WEAK, {name: PureBufferOccupancyRule.__dashjs_factory_name});

        let bitrateList = abrController.getBitrateList(mediaInfo);
        let rateMap = {};

        let step = cushion / (bitrateList.length-1);

        for(let i = 0; i < bitrateList.length; i++){
            rateMap[reservoir + i * step] = bitrateList[i].bitrate;
        }

        let rateMax = bitrateList[bitrateList.length-1].bitrate;
        let rateMin = bitrateList[0].bitrate;
        ratePrev = ratePrev > rateMin ? ratePrev : rateMin;
        let ratePlus = rateMax;
        let rateMinus = rateMin;

        if(ratePrev === rateMax)
            ratePlus = rateMax;
        else
            for(let i = 0; i < bitrateList.length; i++){
                if(bitrateList[i].bitrate > ratePrev){
                    ratePlus = bitrateList[i].bitrate;
                    break;
                }
            }

        if(ratePrev === rateMin){
            rateMinus = rateMin;
        }            
        else{
            for(let i = bitrateList.length-1; i >= 0; i--){
                if(bitrateList[i].bitrate < ratePrev){
                    rateMinus = bitrateList[i].bitrate;
                    break;
                }
            }                
        }
            
        let currentBufferLevel = dashMetrics.getCurrentBufferLevel(metrics);
        let bufNow = defineRateMap(currentBufferLevel, step, rateMap);

        let rateNext;
        if(currentBufferLevel <= reservoir)
            rateNext = rateMin;
        else if(currentBufferLevel >= reservoir + cushion)
            rateNext = rateMax;
        else if(bufNow >= ratePlus){
            for(let i = bitrateList.length-1; i >= 0; i--){
                if(bitrateList[i].bitrate <= bufNow){
                    rateNext = bitrateList[i].bitrate;
                    break;
                }
            }
        }
        else if(bufNow <= rateMinus){
            for(let i = 0; i < bitrateList.length; i++){
                if(bitrateList[i].bitrate > bufNow){
                    rateNext = bitrateList[i].bitrate;
                    break;
                }
            }
        }
        else
            rateNext = ratePrev;
        ratePrev = rateNext;
        switchRequest.quality = abrController.getQualityForBitrate(mediaInfo, rateNext/1000, 0);

        if(currentBufferState != null){
            if(currentBufferLevel > currentBufferState.target){
                ifBufferRich = (currentBufferLevel - currentBufferState.target) > mediaPlayerModel.getRichBufferThreshold();

                if(ifBufferRich && maxIndex > 0){
                    switchRequest.value = maxIndex;
                    switchRequest.priority = SwitchRequest.STRONG;
                    switchRequest.reason.bufferLevel = currentBufferLevel;
                    switchRequest.reason.bufferTarget = currentBufferState.target;                    
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

    instance = {
        execute: execute
    };

    setup();
    return instance;
}

PureBufferOccupancyRule.__dashjs_factory_name = 'PureBufferOccupancyRule';
export default FactoryMaker.getClassFactory(PureBufferOccupancyRule);

/*  edits in other files

    - ABRRulesCollection.js
    import PureBufferOccupancyRule from "./PureBufferOccupancyRule";
    qualitySwitchRules.push(
        PureBufferOccupancyRule(context).create({
        metricsModel: metricsModel,
        dashMetrics: dashMetrics,
        mediaPlayerModel: mediaPlayerModel
    })
); */
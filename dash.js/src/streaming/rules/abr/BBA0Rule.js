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

function BBA0Rule(config){
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

    //  Input: Rateprev: The previously used video rate; Bufnow: The current buffer occupancy
    //  r: The size of reservoir; cu: The size of cushion
    //  Output: Ratenext: The next video rate

    //  the size of reservoir needs to be at least one chunk
    const reservoir = 24; 
    // the buffer distance between B1 and Bm or 0.9*bufferlength
    const cushion = 126;

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

    function getMaxIndex(rulesContext){
        // retrieve information
        let current = rulesContext.getCurrentValue();
        let streamProcessor = rulesContext.getStreamProcessor();

        let trackInfo = rulesContext.getTrackInfo();
        let waitToSwitchTime = !isNaN(trackInfo.fragmentDuration) ? trackInfo.fragmentDuration / 2 : 2;

        let mediaInfo = rulesContext.getMediaInfo();
        let mediaType = mediaInfo.type;

        let abrController = streamProcessor.getABRController();
        let metrics = metricsModel.getReadOnlyMetricsFor(mediaType);

        let ifBufferRich = false;
        let switchRequest = SwitchRequest(context).create(SwitchRequest.NO_CHANGE, SwitchRequest.WEAK, {name: BBA0Rule.__dashjs_factory_name});

        let bitrateList = abrController.getBitrateList(mediaInfo);
        let rateMap = {};
        let step = cushion / (bitrateList.length-1);
        for(let i = 0; i < bitrateList.length; i++){
            rateMap[reservoir + i * step] = bitrateList[i].bitrate;
        }

        let rateMax = bitrateList[bitrateList.length-1].bitrate;
        let rateMin = bitrateList[0].bitrate;
        ratePrev = ratePrev > rateMin ? ratePrev : rateMin;
        let ratePlus = 0;
        let rateMinus = 0;

    // if Rateprev = Rmax then
    //      Rate+ = Rmax
    // else
    //      Rate+ = min{Ri : Ri > Rateprev}
        if(ratePrev === rateMax)
            ratePlus = rateMax;
        else
            for(let i = 0; i < bitrateList.length; i++){
                if(bitrateList[i].bitrate > ratePrev){
                    ratePlus = bitrateList[i].bitrate;
                    break;
                }
            }

    // if Rateprev = Rmin then
    //      Rate− = Rmin
    // else
    //      Rate− = max{Ri : Ri < Rateprev}
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
        
    // if Bufnow ≤ r then
    //      Ratenext = Rmin
    // else if Bufnow ≥ (r + cu) then
    //      Ratenext = Rmax
    // else if f(Bufnow) ≥ Rate+ then
    //      Ratenext = max{Ri : Ri < f(Bufnow)};
    // else if f(Bufnow) ≤ Rate− then
    //      Ratenext = min{Ri : Ri > f(Bufnow)};
    // else
    //      Ratenext = Rateprev;            
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
        switchRequest.quality = abrController.getQualityForBitrate(mediaInfo, rateNext, 0); //set latency to 0
        
         return switchRequest;
    }

    function reset() {
        // no persistent information to reset
    }

    instance = {
        getMaxIndex: getMaxIndex,
        reset: reset
    };

    setup();

    return instance;
}

BBA0Rule.__dashjs_factory_name = 'BBA0Rule';
export default FactoryMaker.getClassFactory(BBA0Rule);

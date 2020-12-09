import SwitchRequest from '../SwitchRequest';
import AbrController from '../../controllers/AbrController';
import FactoryMaker from '../../../core/FactoryMaker';
import Debug from '../../../core/Debug';

function PureBufferOccupancyRule(config){
    config = config || {};

    let instance;  //returned object
    let logger;    //Debug tool as specified inside other rules
    let prevStreamTime; 

    const context = this.context;
    
    const metricsModel = config.metricsModel;
    const dashMetrics = config.dashMetrics;
    const mediaPlayerModel = config.mediaPlayerModel;


    function setup(){
    }

    function execute(rulesContext, callback){
    }

    instance = {
        execute: execute
    };

    setup();
    return instance;
}

PureBufferOccupancyRule.__dashjs_factory_name = 'BufferOccupancyRule';
export default FactoryMaker.getClassFactory(PureBufferOccupancyRule);
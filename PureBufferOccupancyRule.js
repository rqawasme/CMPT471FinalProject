// a pure bu↵er-based design: we
// select the video rate directly as a function of the current
// bu↵er level. As we find, this approach works well when the
// bu↵er adequately encodes information about the past history of capacity. However, when the bu↵er is still growing
// from empty (during the first few minutes of a session), it
// does not adequately encode information about available capacity

import SwitchRequest from '../SwitchRequest';
import MediaPlayerModel from '../../models/MediaPlayerModel';
import AbrController from '../../controllers/AbrController';
import FactoryMaker from '../../../core/FactoryMaker';
import Debug from '../../../core/Debug';

function PureBufferOccupanyRule(config) {
    MIN_BUFFER_LEN = 10;
    MAX_BUFFER_LEN = 50;

    let instance;
    let log = Debug(context).getInstance().log;
    let dashMetrics = config.dashMetrics;
    let metricsModel = config.metricsModel;

    function setup() {
        
    }

    function execute(rulesContext, callback) {

    }

    function reset() {
        setup();
    }

    instance = {
        execute: execute,
        reset: reset
    };

    setup();

    return instance;
}
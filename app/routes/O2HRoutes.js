module.exports = app =>{
    const { helpers, settings,authPlayer } = require("../middlewares/appMiddleware.js")
    
    const O2H = require("../controllers/O2HController.js")

    var router = require("express").Router();

    router.use(helpers)

    router.use(authPlayer)
    
    // router.get("/fetch-game-progress-guesser/:token",O2H.fetch_game_progress_guesser);
    router.get("/create-single-player",O2H.create_single_player);

    router.get("/create-oracle-multi-player",O2H.create_multi_player);
    router.post("/join-oracle-multi-player",O2H.join_multi_player);
    router.post("/start-oracle-multi-player",O2H.start_multi_player);

    router.post("/o2h-request-segment",O2H.request_segment);
    router.post("/o2h-submit-guess",O2H.submit_guess);

    

    app.use("/",router);
}
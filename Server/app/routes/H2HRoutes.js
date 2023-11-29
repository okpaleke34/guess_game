module.exports = app =>{
    const { helpers, settings,authPlayer } = require("../middlewares/appMiddleware.js")
    
    const H2H = require("../controllers/H2HController.js")

    var router = require("express").Router();

    router.use(helpers)
    router.use(authPlayer)

    router.get("/fetch-game-progress-proposer/:token",H2H.fetch_game_progress_proposer);
    
    router.get("/create-duo-player",H2H.create_duo_player);
    router.post("/join-duo-player",H2H.join_duo_player);
    router.get("/create-friends-multi-player",H2H.create_multi_player);
    router.post("/join-friends-multi-player",H2H.join_multi_player);
    router.post("/start-friends-multi-player",H2H.start_multi_player);

    router.post("/h2h-request-segment",H2H.request_segment);
    router.post("/show-segment",H2H.show_segment);
    router.post("/submit-guess",H2H.submit_guess);
    router.post("/react-to-guess",H2H.react_to_guess);

    app.use("/",router);
}
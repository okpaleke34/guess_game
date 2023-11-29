module.exports = app =>{
    const { helpers, settings,authPlayer } = require("../middlewares/appMiddleware.js")
    
    const game = require("../controllers/gameController.js")

    var router = require("express").Router();


    router.use(helpers)
    router.post("/register",game.register);
    router.post("/login",game.login);
    router.post("/reset-password",game.reset_password);

    router.use(authPlayer)
    // Routes below needs authentication before it can be accessed
    router.get("/fetch-game-details/:arena_token",game.fetch_game_details);
    router.get("/fetch-player-history",game.fetch_player_history);
    router.get("/fetch-leader-board",game.fetch_leader_board);

    router.get("/fetch-game-progress-guesser/:token",game.fetch_game_progress_guesser);
    


    router.post("/check-player-authentication",game.check_player_authentication);
    router.post("/update-profile",game.update_profile);
    router.post("/update-settings",game.update_settings);


    // Needed by both human to human(h2h) and oracle to human(o2h)
    router.post("/give-up",game.give_up);
    router.post("/submit-suggestion",game.submit_suggestion);    

    app.use("/",router);
}
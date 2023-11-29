module.exports = app =>{
    const { helpers, settings,authPlayer } = require("../middlewares/appMiddleware.js")
    
    const game = require("../controllers/gameController.js")

    var router = require("express").Router();

    router.use(helpers)
    router.post("/register",game.register);
    router.post("/login",game.login);
    router.post("/reset-password",game.reset_password);

    router.use(authPlayer)

    router.get("/fetch-game-progress-guesser/:token",game.fetch_game_progress_guesser);
    router.get("/fetch-game-progress-proposer/:token",game.fetch_game_progress_proposer);

    router.get("/fetch-game-details/:arena_token",game.fetch_game_details);
    router.get("/fetch-player-history",game.fetch_player_history);
    router.get("/fetch-leader-board",game.fetch_leader_board);
    


    router.post("/check-player-authentication",game.check_player_authentication);
    router.post("/update-profile",game.update_profile);
    router.post("/update-settings",game.update_settings);
    
    router.post("/create-duo-player",game.create_duo_player);
    router.post("/join-duo-player",game.join_duo_player);


    router.post("/show-segment",game.show_segment);
    router.post("/submit-guess",game.submit_guess);
    router.post("/react-to-guess",game.react_to_guess);

    router.post("/give-up",game.give_up);
    router.post("/submit-suggestion",game.submit_suggestion);
    

    // router.post("/join-game",game.join_game);
    // router.post("/create-game",game.create_game);
    
    

    app.use("/",router);
}
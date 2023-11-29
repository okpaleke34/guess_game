module.exports = (con,Sequelize) =>{
  const {STRING,INTEGER,JSON,TEXT} = Sequelize
  const Arena = con.define("arena",{
    arena_token: {
      type: STRING(16),
      allowNull: false
    },
    type: {
      type: STRING(32),
      allowNull: false
    },
    proposer_id: {
      type: INTEGER,
      allowNull: false
    },
    guessers_id: {
      type: JSON,
      defaultValue: [],
      allowNull: true,
      comment: "This is the list of guessers that has joined the game"
    },
    quitters_id: {
      type: JSON,
      defaultValue: [],
      allowNull: true,
      comment: "This is the list of guessers that left the game before completion"
    },
    guessers_suggestion: {
      type: JSON,
      defaultValue: [],
      allowNull: true,
      comment: "This is the list of segments suggested by the guessers that participated in the game [{guesser_id,segments:[]}]"
    },
    game_id: {
      type: INTEGER,
      allowNull: false,
      comment:"The game_id will be the id of the game in the games table that will be used as a relation of games.hasmany arena and arena.belongsTo games"
    },
    guesses:{
      type: JSON,
      defaultValue: [],
      comment: "This is the list of word guesses that has been made by the guessers. If one segment is shown, a guesser can guess maximum of 3 times. [ {segment:1,guessers:[{guesser_id, guesses:[time_stamp,status,guess]}]} ]"
    },
    displayed_segments:{
      type: JSON,
      defaultValue: [],
      comment: "This is the list of segments that has been shown to the guesser"
    },
    final_score: {
      type: INTEGER,
      defaultValue: 0,
      comment: "Final score for the match. This will be calculated by {number of elapsed time(time_ended - time_started)}/60 * {number of segments shown(displayed_segments)} * {Number of players(count(guessers_id))} * {trials} The lower the score the higher on leader board"
    },
    time_started: {
      type: STRING(10),
      allowNull: true,
      comment: "This is the time when the first segment was sent to the guesser(s)"
    },
    time_ended: {
      type: STRING(10),
      allowNull: true,
      comment: "This is the time when the guessing section ended, either giving up or getting correct answer"
    },
    trials: {
      type: INTEGER,
      defaultValue: 0,
      comment: "How many times the guesser(s) has guessed, not useful"
    },
    status: {
      type: INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "0: waiting, 1: Joined, 2: Quit, 3: Won"
    }    
  }, {
    freezeTableName: true, // set this option to true to use the singular model name as the table name
    charset: 'latin1',
    collate: 'latin1_swedish_ci'
  });

  return Arena
}
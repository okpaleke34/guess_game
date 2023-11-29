const { randomInt, updateGuess, calculateTrials } = require("../helpers/functions");
const moment = require("moment");


class Oracle {
  /**
   * This is the constructor for the Oracle class
   * @param {*} id The id of the oracle
   * @param {*} db The database object
   * @description This is the constructor for the Oracle class
   * @example
   * const oracle = new Oracle(123, db);
   */
  constructor(id,db) {
    this.id = id;
    this.db = db;
    this.oracle = null;
    if(id != null && db != null){
      this.initializeOracle();
    }    
  }

  async initializeOracle() {
    try {
      // Fetch the oracle from the database
      let oracle = await this.db.Oracle.findOne({where:{id:this.id}})
      if(!oracle){
        oracle = await this.db.Oracle.create()
        this.id = oracle.id
        // console.log("Created new oracle",oracle.id,this.id)
      }

      // Update oracle properties based on the async result
      this.oracle = oracle.dataValues;
      // console.log("Initialized oracle",oracle.username)
    }
    catch (error) {
      console.error('Initialization error:', error);
    }
  }


  /**
   * This method will verify the guess made by the player
   * @param {*} guess the guess that the player made
   * @returns true if the guess is correct, false otherwise
   */
  async verifyGuess(segment,playerID,newGuess) {
    await this.initializeOracle();
    // Fetch the correct answer from the games table
    let arena = await this.db.Arena.findOne({
      where:{id:this.oracle.arena_id},
      include:[{ model: this.db.Game, as: 'game' }]
    })
    if (!arena) {
      throw new Error('Could not find arena');
      // return {status:null,message:"Could not find arena"}
    }
    // Check if the guess is correct
    let isGuessCorrect = arena.game.answer.trim().toUpperCase() == newGuess.guess.trim().toUpperCase()
    if(isGuessCorrect){
      newGuess.status = 1
    }
    else{
      newGuess.status = -1
    }
    var {guesses,time_started,displayed_segments,guessers_id} = arena.dataValues
    guesses = JSON.parse(guesses);
    var update = {}
    update.guesses = updateGuess(guesses,playerID,segment,newGuess)
    let final_score = 0
    if(isGuessCorrect){
      // If the guess is correct, then update the final_score
      update.status = 3
      update.time_ended = moment().tz('Europe/Oslo').unix()
      // This will be calculated by {number of elapsed time(time_ended - time_started)}/60 * {number of segments shown(displayed_segments)} * {Number of players(count(guessers_id))} * {trials} The lower the score the higher on leader board
      final_score = ((update.time_ended - time_started)/60) * JSON.parse(displayed_segments).length * JSON.parse(guessers_id).length * calculateTrials(update.guesses)
      final_score = Math.round(final_score)
      update.final_score = final_score
    }

    await this.db.Arena.update(update,{where:{id:this.oracle.arena_id}})
    if(isGuessCorrect){
      return {status:true,final_score,answer:arena.game.answer,data:{segment,newGuess}}
    }
    else{
      return {status:false,message:"Wrong guess",data:{segment,newGuess}}
    }
  }

  /**
   * This method will return the next segment from the proposal_segments
   */
  async nextSegment() {
    // To make sure the oracle is initialized
    await this.initializeOracle();
    let proposalSegments = JSON.parse(this.oracle.proposal_segments);
    let arena = await this.db.Arena.findOne({where:{id:this.oracle.arena_id}});
    if(!arena){
      // console.log("Arena not found")
      return null
    }
    let displayed_segments = JSON.parse(arena.displayed_segments);
    let totalDisplayed = displayed_segments.length;
    if(proposalSegments.length > totalDisplayed){
      let nextSegment = proposalSegments[totalDisplayed];
      let updatedArena = {displayed_segments:[...displayed_segments,nextSegment]};
      let returnData = {segment:nextSegment}
      // if it is the first segment start game
      if(totalDisplayed == 0){
        updatedArena.time_started = moment().tz('Europe/Oslo').unix()
        returnData.time_started = updatedArena.time_started
      }
      // Update the arena with the new displayed_segments
      arena = await this.db.Arena.update(updatedArena,{where:{id:this.oracle.arena_id}})
      if(arena){
        return returnData
      }else{
        // console.log("Could not update arena");
        return null
      }
    }
    else{
      // console.log("No more segments")
      return null
    }
  }

  /**
   * This method will get the list of games that are available for playing 
   * and will randomly choose one of the games from the list
   * @returns The game_id of the chosen game
   */
  async chooseGame(){
    let game_count = await this.db.Game.count({where:{status:1}});
    let game_id = randomInt(0,game_count) + 1;
    // console.log("Fill Segments =>fillSegments([2],10)",this.fillSegments([2],10))
    return game_id
  }
  

  /**
   * This method will find the best reference arena for the chosen game and then generate the oracle proposal_segments
   * It will go to Arena table and find the arena with the highest score and the same game_id the guessers_suggestion is not empty
   * If it could not find any arena, it will check if there is arena with empty guessers_suggestion then it will take the displayed_segments list and append other segments to it
   * and will randomly choose one of the games from the list
   * @param {*} game_id The game_id of the chosen game
   * @param {*} arena_id The arena_id of the current arena
   * @returns The game_id of the chosen game
   */
  async chooseReferenceGame(game_id,arena_id){
    var proposal_segments = [];
    var proposal_type = 0;
    var ref_arena = arena_id;
    // let game_id = await this.chooseGame();
    // Find the arena with the highest score and the same game_id the guessers_suggestion is not empty
    let arena = await this.db.Arena.findOne({
      where:{
        game_id:game_id,
        guessers_suggestion:{
          [this.db.Sequelize.Op.ne]: []
        },
        final_score:{
          [this.db.Sequelize.Op.ne]: 0
        }
      },
      include:[{ model: this.db.Game, as: 'game' }],
      order:[['final_score', 'ASC']]
    });

    if(arena){
      // Use the guessers_suggestion to generate the new proposal_segments
      let primeGuessersSuggestion = this.getPrimeGuessersSuggestion(JSON.parse(arena.guessers_suggestion));
      proposal_segments = this.fillSegments(primeGuessersSuggestion,arena.game.segments);
      proposal_type = 1;
      ref_arena = arena.id;
    }
    else{
      // If there is no arena with the same game_id and guessers_suggestion is not empty, find the arena with the same game_id and guessers_suggestion is empty
      arena = await this.db.Arena.findOne({
        where:{
          game_id:game_id,
          guessers_suggestion:{
            [this.db.Sequelize.Op.eq]: []
          },
          final_score:{
            [this.db.Sequelize.Op.ne]: 0
          }
        },
        include:[{ model: this.db.Game, as: 'game' }],
        order:[['final_score', 'ASC']]
      });
      
      if(arena){
        // Get the displayed_segments from the arena and fill the proposal_segments with the missing segments
        let displayed_segments = [];
        [...JSON.parse(arena.displayed_segments)].forEach(segment => {
          displayed_segments.push(Number(segment));
        });
        proposal_segments = this.fillSegments(displayed_segments,arena.game.segments);
        proposal_type = 2;
        ref_arena = arena.id;
      }
      else{
        // If it does not find any reference arena, generate the proposal_segments from the game segments
        let game = await this.db.Game.findOne({where:{id:game_id}});
        proposal_segments = this.fillSegments([],game.segments);
      }
    }
    let updateOracle = await this.db.Oracle.update({proposal_segments,proposal_type,ref_arena,arena_id},{where:{id:this.id}});
    if(updateOracle){
      return this.id
    }
    else{
      return false
    }
  }


  
  /**
   * This method will make sure an array is filled with the number of segments that is missing
   * @returns filled segments array
   */
  fillSegments(filledSegments, totalSegments){
    let remainingSegments = [];
    let segments = [...filledSegments];
    // Fill the remainingSegments array with segments that has not been filled
    for (let i = 0; i < totalSegments+1; i++) {
      if(!filledSegments.includes(i)){
        remainingSegments.push(i);
      }      
    }
    // This will randomly fill the segments array with the remaining segments
    for (let i = 0; i < remainingSegments.length; i++) {
      let index = randomInt(0,remainingSegments.length);
      segments.push(remainingSegments[index]);
      remainingSegments.splice(index,1);
      i -= 1;
    }
    return segments
  }
  
  /**
   * This method will return the prime guessers suggestion
   * It will check how many guessers_suggestion are available
   * If the guessers_suggestion has only one element, it will return the segments of the guessers_suggestion
   * If the guessers_suggestion has more than one element, it will take the first chunkSize segments from each guessers_suggestion and arrange them by highest occurrence
   * @param {*} suggestions different guessers suggestions
   * @returns prime guessers suggestion
   */
  getPrimeGuessersSuggestion(suggestions){
    let primeGuessersSuggestion = [];
    let guessersSuggestion = [...suggestions];
    let maxSegments = 0;
    // This will not happen because it will take the proposer displayed_segments if there is no guessers_suggestion
    if(guessersSuggestion.length == 0){
      return []
    }
    // If there is only one guessers_suggestion, return it
    if(guessersSuggestion.length == 1){
      return guessersSuggestion[0].segments
    }
    // Get the guessers_suggestion with the highest number of segments
    for (let i = 0; i < guessersSuggestion.length; i++) {
      if(guessersSuggestion[i].segments.length > maxSegments){
        maxSegments = guessersSuggestion[i].segments.length;
      }
    }

    // Chunk size is the number of segments that will be taken from each guessers suggestion
    let chunkSize = 5;
    // This will loop through the guessers_suggestion and take the first chunkSize segments from each guesser suggestion
    for (let i = 0; i < Math.ceil(maxSegments / chunkSize); i++) {
      let chunkSegments = [];
      guessersSuggestion.forEach(guessersSuggestion => {
        let guesserChunk = this.chunkArray(guessersSuggestion.segments, chunkSize)[i]
        if(guesserChunk){
          chunkSegments.push(guesserChunk)
        }
      });
      primeGuessersSuggestion.push(...this.arrangeByHighestOccurrence(chunkSegments.flat()))
    }
    return [...new Set(primeGuessersSuggestion)] // Remove duplicates
  }

  /**
   * This method returns an array of elements arranged by highest occurrence
   * @param {*} arr
   * @returns unique array of elements arranged by highest occurrence
   */
  arrangeByHighestOccurrence(arr) {
    // Step 1: Create a frequency map
    const frequencyMap = arr.reduce((map, element) => {
      map[element] = (map[element] || 0) + 1;
      return map;
    }, {});
  
    // Step 2: Sort the array by occurrences in descending order
    const sortedArray = arr.sort((a, b) => frequencyMap[b] - frequencyMap[a]);
  
    return [...new Set(sortedArray)];// Remove duplicates
  }

  /**
   * This method will chunk the array into smaller arrays
   * @param {*} array 
   * @param {*} chunkSize 
   * @returns 
   */
  chunkArray(array, chunkSize) {
    const result = [];
    const arrayLength = array.length;
  
    for (let i = 0; i < arrayLength; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      result.push(chunk);
    }
  
    return result;
  }
}
module.exports = Oracle;
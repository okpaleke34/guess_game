const { expect } = require('chai');
const Oracle = require('../app/classes/Oracle');

describe('Oracle Class', () => {
  let oracleInstance;

  beforeEach(() => {
    // Initialize a new instance of the Oracle class before each test
    oracleInstance = new Oracle(null, null);
  });

  describe('fillSegments method', () => {
    it('should fill missing segments in the array', () => {
      const filledSegments = [1, 3, 5];
      const totalSegments = 7;
  
      const result = oracleInstance.fillSegments(filledSegments, totalSegments);
      // Your assertion based on the expected behavior
      expect(result).to.have.lengthOf(totalSegments + 1);
      // expect(result).to.include.members(filledSegments);
    });

    it('should contain the default filled segments in the final array', () => {
      const filledSegments = [1, 3, 5];
      const totalSegments = 7;  
      const result = oracleInstance.fillSegments(filledSegments, totalSegments);
      // Your assertion based on the expected behavior
      // expect(result).to.have.lengthOf(totalSegments + 1);
      expect(result).to.include.members(filledSegments);
    });
  });

  describe('getPrimeGuessersSuggestion method', () => {
    it('should return prime guessers suggestion', () => {
      const suggestions = [
        { segments: [1, 2, 3, 4, 5] },
        { segments: [2, 3, 4, 5, 6] },
        { segments: [1, 2, 3, 4, 5, 6, 7] },
      ];

      const result = oracleInstance.getPrimeGuessersSuggestion(suggestions);

      // Your assertion based on the expected behavior
      expect(result).to.have.lengthOf.at.least(1);
    });
  });

  describe('arrangeByHighestOccurrence method', () => {
    it('should arrange array by highest occurrence', () => {
      const arr = [1, 2, 2, 3, 4, 4, 5];

      const result = oracleInstance.arrangeByHighestOccurrence(arr);
      
      // Your assertion based on the expected behavior
      expect(result).to.deep.equal([2, 4, 1, 3, 5]);
    });
  });

  describe('chunkArray method', () => {
    it('should chunk the array into smaller arrays', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8];
      const chunkSize = 3;

      const result = oracleInstance.chunkArray(array, chunkSize);

      // Your assertion based on the expected behavior
      expect(result).to.have.lengthOf(Math.ceil(array.length / chunkSize));
    });
  });
});

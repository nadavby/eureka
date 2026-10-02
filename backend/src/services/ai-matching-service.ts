import { IItem } from '../models/item_model';
import geminiService from './gemini-service';
import { shouldSkipComparison } from './matching-service';


export const AIMatchingService = 
  async(
    targetItem: IItem,
    potentialMatches: IItem[]
  ): Promise<{ item: IItem; confidenceScore: number }[]> => {
    const matches: { item: IItem; confidenceScore: number }[] = [];
    


    console.log(`\n=== Starting Match Analysis ===`);
    console.log(`Looking for matches between ${targetItem.itemType} item and ${potentialMatches.length} potential matches\n`);

    for (const potentialMatch of potentialMatches) {
      try {
        const lostItem = targetItem.itemType === 'lost' ? targetItem : potentialMatch;
        const foundItem = targetItem.itemType === 'found' ? targetItem : potentialMatch;
        
        if (shouldSkipComparison(lostItem, foundItem)) {
          continue;
        }

        const matchEvaluation = await geminiService.evaluateMatch(
          lostItem,
          foundItem,
        );

        console.log('\n=== Match Evaluation Results ===');
        console.log('\n🖼️ Vision Analysis:');
      
        console.log('\n📊 Final Score:', matchEvaluation.confidenceScore + '%');
        console.log('Reasoning:', matchEvaluation.reasoning);
        console.log('\n-------------------------------------------\n');
        
        if (matchEvaluation.confidenceScore >= 70) {
          matches.push({
            item: potentialMatch,
            confidenceScore: matchEvaluation.confidenceScore
          });
        }
      } catch (error) {
        console.error('Error processing potential match:', error);
        continue;
      }
    }

    const sortedMatches = matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
    
    if (sortedMatches.length > 0) {
      console.log(`Found ${sortedMatches.length} high-confidence matches`);
    }

    return sortedMatches;
  }
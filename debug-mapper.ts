
import { mapOsonishCategory } from './lib/mappers/osonish-mapper';

const testCases = [
    {
        cat2: 'MAʼMURIYAT VA BIZNES SOHASIDAGI PROFESSIOANAL-MUTAXASSISLAR',
        cat1: 'PROFESSIONAL-MUTAXASSISLAR',
        title: 'Buxgalter'
    },
    {
        cat2: 'AXBOROT-KOMMUNIKATSIYA TEXNOLOGIYALARI BOʻYICHA PROFESSIONAL-MUTAXASSISLAR',
        cat1: 'PROFESSIONAL-MUTAXASSISLAR',
        title: 'Dasturchi'
    }
];

console.log('Testing Map Logic:');
testCases.forEach(tc => {
    const res = mapOsonishCategory(tc.cat2, null, tc.title);
    if (!res) {
        console.log(`Input: "${tc.cat2}" -> no match`);
        return;
    }
    console.log(`Input: "${tc.cat2}" -> Key: ${res.categoryKey}, MatchedBy: ${res.matchedBy}`);
});

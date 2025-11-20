// content-insights.js - Content Insights & Trivia System
// Cast & crew details, trivia, related content, awards

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Get detailed content insights
async function getContentInsights(itemId, type = 'movie') {
  const insights = {
    cast: [],
    crew: [],
    trivia: [],
    related: [],
    awards: null
  };
  
  try {
    // Get details
    const details = await tmdbFetch(`/${type}/${itemId}`);
    
    // Get credits (cast & crew)
    const credits = await tmdbFetch(`/${type}/${itemId}/credits`);
    if (credits) {
      insights.cast = (credits.cast || []).slice(0, 20).map(actor => ({
        id: actor.id,
        name: actor.name,
        character: actor.character,
        profilePath: actor.profile_path ? `${IMAGE_BASE}${actor.profile_path}` : null,
        knownFor: actor.known_for_department || 'Acting'
      }));
      
      insights.crew = (credits.crew || []).slice(0, 15).map(member => ({
        id: member.id,
        name: member.name,
        job: member.job,
        department: member.department,
        profilePath: member.profile_path ? `${IMAGE_BASE}${member.profile_path}` : null
      }));
    }
    
    // Get external IDs for more data
    const externalIds = await tmdbFetch(`/${type}/${itemId}/external_ids`);
    
    // Get trivia/facts
    const keywords = await tmdbFetch(`/${type}/${itemId}/keywords`);
    if (keywords && keywords.keywords) {
      insights.trivia.push(...keywords.keywords.slice(0, 10).map(k => ({
        type: 'keyword',
        text: k.name
      })));
    }
    
    // Get similar/recommended
    const similar = await tmdbFetch(`/${type}/${itemId}/similar`);
    if (similar && similar.results) {
      insights.related = similar.results.slice(0, 10).map(item => ({
        id: item.id,
        title: item.title || item.name,
        posterPath: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
        type: type,
        rating: item.vote_average,
        reason: 'Similar content'
      }));
    }
    
    // Get recommendations
    const recommendations = await tmdbFetch(`/${type}/${itemId}/recommendations`);
    if (recommendations && recommendations.results) {
      insights.related.push(...recommendations.results.slice(0, 10).map(item => ({
        id: item.id,
        title: item.title || item.name,
        posterPath: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
        type: type,
        rating: item.vote_average,
        reason: 'Recommended for you'
      })));
    }
    
    // Awards (from details if available)
    if (details.awards) {
      insights.awards = details.awards;
    }
    
    // Generate "Did you know?" facts
    insights.trivia.push(...generateDidYouKnowFacts(details, credits));
    
  } catch (error) {
    console.error('Error fetching content insights:', error);
  }
  
  return insights;
}

// Generate "Did you know?" facts
function generateDidYouKnowFacts(details, credits) {
  const facts = [];
  
  if (details.budget && details.budget > 0) {
    facts.push({
      type: 'fact',
      text: `This production had a budget of $${details.budget.toLocaleString()}`
    });
  }
  
  if (details.revenue && details.revenue > 0) {
    const profit = details.revenue - (details.budget || 0);
    facts.push({
      type: 'fact',
      text: `It grossed $${details.revenue.toLocaleString()} ${profit > 0 ? `(profit: $${profit.toLocaleString()})` : ''}`
    });
  }
  
  if (details.runtime) {
    facts.push({
      type: 'fact',
      text: `Runtime: ${details.runtime} minutes (${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m)`
    });
  }
  
  if (details.production_companies && details.production_companies.length > 0) {
    facts.push({
      type: 'fact',
      text: `Produced by: ${details.production_companies.map(c => c.name).join(', ')}`
    });
  }
  
  if (details.production_countries && details.production_countries.length > 0) {
    facts.push({
      type: 'fact',
      text: `Filmed in: ${details.production_countries.map(c => c.name).join(', ')}`
    });
  }
  
  if (credits && credits.cast && credits.cast.length > 0) {
    const mainActor = credits.cast[0];
    facts.push({
      type: 'fact',
      text: `Starring: ${mainActor.name} as ${mainActor.character}`
    });
  }
  
  if (details.original_language && details.original_language !== 'en') {
    const languages = {
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean',
      'hi': 'Hindi',
      'zh': 'Chinese'
    };
    facts.push({
      type: 'fact',
      text: `Original language: ${languages[details.original_language] || details.original_language}`
    });
  }
  
  return facts;
}

// Get actor/crew filmography
async function getPersonFilmography(personId) {
  try {
    const person = await tmdbFetch(`/person/${personId}`);
    const credits = await tmdbFetch(`/person/${personId}/movie_credits`);
    const tvCredits = await tmdbFetch(`/person/${personId}/tv_credits`);
    
    return {
      person: {
        id: person.id,
        name: person.name,
        biography: person.biography,
        profilePath: person.profile_path ? `${IMAGE_BASE}${person.profile_path}` : null,
        knownFor: person.known_for_department,
        birthday: person.birthday,
        placeOfBirth: person.place_of_birth
      },
      movies: (credits?.cast || []).concat(credits?.crew || []).slice(0, 20),
      tvShows: (tvCredits?.cast || []).concat(tvCredits?.crew || []).slice(0, 20)
    };
  } catch (error) {
    console.error('Error fetching person filmography:', error);
    return null;
  }
}

// Get related content by director/actor
async function getRelatedByPerson(itemId, type = 'movie', personId, role = 'director') {
  try {
    const personCredits = await tmdbFetch(`/person/${personId}/${type}_credits`);
    
    if (personCredits && personCredits.cast) {
      return personCredits.cast
        .filter(item => item.id !== itemId)
        .slice(0, 10)
        .map(item => ({
          ...item,
          reason: `Same ${role === 'director' ? 'director' : 'actor'}`
        }));
    }
  } catch (error) {
    console.error('Error fetching related by person:', error);
  }
  
  return [];
}

// Export functions
window.getContentInsights = getContentInsights;
window.getPersonFilmography = getPersonFilmography;
window.getRelatedByPerson = getRelatedByPerson;


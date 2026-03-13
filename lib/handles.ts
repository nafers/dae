const adjectives = [
  'Curious', 'Quiet', 'Wandering', 'Silver', 'Tangled', 'Amber', 'Hollow',
  'Mossy', 'Distant', 'Velvet', 'Gilded', 'Faded', 'Gentle', 'Wistful',
  'Nimble', 'Drifting', 'Ancient', 'Calm', 'Clever', 'Cobalt', 'Crimson',
  'Daydream', 'Dusky', 'Earnest', 'Fleeting', 'Foggy', 'Fond', 'Glowing',
  'Golden', 'Graceful', 'Hidden', 'Hopeful', 'Hushed', 'Ivory', 'Jade',
  'Lantern', 'Lazy', 'Lofty', 'Lone', 'Lucky', 'Luminous', 'Lunar',
  'Mellow', 'Midnight', 'Muted', 'Mystic', 'Noble', 'Nomad', 'Onyx',
  'Open', 'Pale', 'Patient', 'Pensive', 'Playful', 'Prism', 'Rainy',
  'Rare', 'Restless', 'Roaming', 'Rustic', 'Sandy', 'Sapphire', 'Scarlet',
  'Secret', 'Serene', 'Shady', 'Shy', 'Silent', 'Simple', 'Sleepy',
  'Slow', 'Smoky', 'Soft', 'Solemn', 'Starry', 'Still', 'Stormy',
  'Stray', 'Sunlit', 'Swift', 'Tender', 'Thankful', 'Timid', 'Tiny',
  'Tranquil', 'True', 'Twilight', 'Unsung', 'Verdant', 'Warm', 'Whimsy',
  'Wild', 'Windy', 'Winter', 'Wise', 'Wispy', 'Witty', 'Wonder', 'Worn',
]

const nouns = [
  'Maple', 'Kite', 'River', 'Stone', 'Sparrow', 'Tide', 'Cedar', 'Lantern',
  'Moth', 'Creek', 'Finch', 'Harbor', 'Birch', 'Candle', 'Cloud', 'Clover',
  'Coral', 'Crane', 'Dune', 'Echo', 'Elm', 'Ember', 'Falcon', 'Fern',
  'Field', 'Fog', 'Forest', 'Fox', 'Frost', 'Gale', 'Garden', 'Glen',
  'Grove', 'Gull', 'Heron', 'Hill', 'Hollow', 'Horizon', 'Isle', 'Ivy',
  'Jasper', 'Lake', 'Leaf', 'Linden', 'Loon', 'Marsh', 'Meadow', 'Mist',
  'Moon', 'Moss', 'Mountain', 'Oak', 'Ocean', 'Otter', 'Owl', 'Path',
  'Peak', 'Pebble', 'Pine', 'Pool', 'Prairie', 'Rain', 'Reed', 'Ridge',
  'Robin', 'Rock', 'Root', 'Rush', 'Sand', 'Shore', 'Sky', 'Snow',
  'Spring', 'Star', 'Storm', 'Stream', 'Sun', 'Swallow', 'Swan', 'Thorn',
  'Timber', 'Trail', 'Valley', 'Vine', 'Wave', 'Willow', 'Wind', 'Wing',
  'Wolf', 'Wood', 'Wren', 'Yarrow', 'Ash', 'Bay', 'Brook', 'Cliff',
  'Cove', 'Dale', 'Dell', 'Dew', 'Dove', 'Dusk', 'Fawn', 'Flint',
]

export function generateHandle(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj}${noun}`
}

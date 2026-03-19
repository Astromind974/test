'use strict';
const tf = require('@tensorflow/tfjs-node');
const mobilenet = require('@tensorflow-models/mobilenet');

const ANIMAL_KEYWORDS = new Set([
  'cat', 'dog', 'bird', 'fish', 'snake', 'lizard', 'frog', 'turtle',
  'lion', 'tiger', 'bear', 'wolf', 'fox', 'rabbit', 'hamster', 'horse',
  'cow', 'pig', 'sheep', 'goat', 'deer', 'elephant', 'giraffe', 'zebra',
  'monkey', 'gorilla', 'chimpanzee', 'panda', 'koala', 'kangaroo',
  'penguin', 'eagle', 'hawk', 'owl', 'parrot', 'duck', 'goose', 'swan',
  'crab', 'lobster', 'shrimp', 'octopus', 'jellyfish', 'shark', 'whale',
  'dolphin', 'seal', 'otter', 'beaver', 'squirrel', 'chipmunk', 'mouse',
  'rat', 'hedgehog', 'bat', 'bee', 'butterfly', 'caterpillar', 'beetle',
  'ant', 'spider', 'scorpion', 'snail', 'worm', 'crayfish', 'starfish',
]);

function isAnimal(label) {
  const labelLower = label.toLowerCase().replace(/_/g, ' ');
  for (const keyword of ANIMAL_KEYWORDS) {
    if (labelLower.includes(keyword)) return true;
  }
  return false;
}

let _model = null;

async function loadModel() {
  if (!_model) {
    console.log('⏳  Chargement du modèle MobileNet…');
    _model = await mobilenet.load({ version: 2, alpha: 1.0 });
    console.log('✅  Modèle chargé.');
  }
  return _model;
}

// For testing purposes: allow injecting a mock model
function setModel(mockModel) {
  _model = mockModel;
}

async function classifyImage(imageBuffer) {
  const net = await loadModel();
  let imageTensor;
  try {
    imageTensor = tf.node.decodeImage(imageBuffer, 3);
    const resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
    imageTensor.dispose();

    const predictions = await net.classify(resized, 5);
    resized.dispose();

    // predictions: [{className: 'tabby, tabby cat', probability: 0.62}, ...]
    return predictions.map(p => ({
      label: p.className,
      score: p.probability,
    }));
  } catch (err) {
    if (imageTensor) imageTensor.dispose();
    throw err;
  }
}

module.exports = { isAnimal, classifyImage, loadModel, setModel, ANIMAL_KEYWORDS };

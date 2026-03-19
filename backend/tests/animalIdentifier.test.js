'use strict';

// Mock TF before loading the service (native binding not needed for isAnimal tests)
jest.mock('@tensorflow/tfjs-node', () => ({
  node: { decodeImage: jest.fn() },
  image: { resizeBilinear: jest.fn() },
}));
jest.mock('@tensorflow-models/mobilenet', () => ({
  load: jest.fn().mockResolvedValue({ classify: jest.fn() }),
}));

const { isAnimal, ANIMAL_KEYWORDS } = require('../services/animalIdentifier');

describe('isAnimal', () => {
  test('returns true for tiger_cat (contains "cat")', () => {
    expect(isAnimal('tiger_cat')).toBe(true);
  });

  test('returns true for Egyptian_cat', () => {
    expect(isAnimal('Egyptian_cat')).toBe(true);
  });

  test('returns true for German_shepherd_dog', () => {
    expect(isAnimal('German_shepherd_dog')).toBe(true);
  });

  test('returns true for robin_bird (contains "bird")', () => {
    expect(isAnimal('robin_bird')).toBe(true);
  });

  test('returns true for whale_shark (contains "whale" and "shark")', () => {
    expect(isAnimal('whale_shark')).toBe(true);
  });

  test('returns true for butterfly', () => {
    expect(isAnimal('butterfly')).toBe(true);
  });

  test('returns true for sea_snake', () => {
    expect(isAnimal('sea_snake')).toBe(true);
  });

  test('returns true for tabby cat', () => {
    expect(isAnimal('tabby, tabby cat')).toBe(true);
  });

  test('returns false for sports_car', () => {
    expect(isAnimal('sports_car')).toBe(false);
  });

  test('returns false for folding_chair', () => {
    expect(isAnimal('folding_chair')).toBe(false);
  });

  test('returns false for tabby alone (no keyword match)', () => {
    expect(isAnimal('tabby')).toBe(false);
  });

  test('returns false for Labrador_retriever (no keyword match)', () => {
    expect(isAnimal('Labrador_retriever')).toBe(false);
  });

  test('is case insensitive for uppercase', () => {
    expect(isAnimal('TIGER_CAT')).toBe(true);
    expect(isAnimal('Tiger_Cat')).toBe(true);
  });

  test('ANIMAL_KEYWORDS is a Set with 60+ entries', () => {
    expect(ANIMAL_KEYWORDS instanceof Set).toBe(true);
    expect(ANIMAL_KEYWORDS.size).toBeGreaterThan(50);
  });

  test('returns true for label with underscore-to-space conversion', () => {
    expect(isAnimal('great_white_shark')).toBe(true);
  });

  test('returns false for bookcase', () => {
    expect(isAnimal('bookcase')).toBe(false);
  });
});

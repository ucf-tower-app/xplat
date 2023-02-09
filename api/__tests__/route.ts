import {
  convertBoulderStringToClassifier,
  convertCompetitionStringToClassifier,
  convertLeadclimbStringToClassifier,
  convertTopropeStringToClassifier,
  convertTraverseStringToClassifier,
} from '../route';

test('boulder strings are properly converted to their RouteClassifier', () => {
  expect(convertBoulderStringToClassifier('VB').rawgrade).toBe(40);
  expect(convertBoulderStringToClassifier('V0').rawgrade).toBe(50);
  expect(convertBoulderStringToClassifier('V1').rawgrade).toBe(60);
});

test('traverse strings are properly converted to their RouteClassifier', () => {
  expect(convertTraverseStringToClassifier('Beginner').rawgrade).toBe(50);
  expect(convertTraverseStringToClassifier('Intermediate').rawgrade).toBe(70);
  expect(convertTraverseStringToClassifier('Advanced').rawgrade).toBe(90);
});

test('toprope strings are properly converted to their RouteClassifier', () => {
  expect(convertTopropeStringToClassifier('5.6-').rawgrade).toBe(58);
  expect(convertTopropeStringToClassifier('5.6').rawgrade).toBe(60);
  expect(convertTopropeStringToClassifier('5.6+').rawgrade).toBe(62);
  expect(convertTopropeStringToClassifier('5.7').rawgrade).toBe(70);
  expect(convertTopropeStringToClassifier('5.7A').rawgrade).toBe(67);
  expect(convertTopropeStringToClassifier('5.7B').rawgrade).toBe(69);
  expect(convertTopropeStringToClassifier('5.7C').rawgrade).toBe(71);
  expect(convertTopropeStringToClassifier('5.7D').rawgrade).toBe(73);
});

test('leadclimb strings are properly converted to their RouteClassifier', () => {
  expect(convertLeadclimbStringToClassifier('5.6-').rawgrade).toBe(58);
  expect(convertLeadclimbStringToClassifier('5.6').rawgrade).toBe(60);
  expect(convertLeadclimbStringToClassifier('5.6+').rawgrade).toBe(62);
  expect(convertLeadclimbStringToClassifier('5.7').rawgrade).toBe(70);
  expect(convertLeadclimbStringToClassifier('5.7A').rawgrade).toBe(67);
  expect(convertLeadclimbStringToClassifier('5.7B').rawgrade).toBe(69);
  expect(convertLeadclimbStringToClassifier('5.7C').rawgrade).toBe(71);
  expect(convertLeadclimbStringToClassifier('5.7D').rawgrade).toBe(73);
});

test('competition strings are properly converted to their RouteClassifier', () => {
  expect(convertCompetitionStringToClassifier('A').rawgrade).toBe(50);
  expect(convertCompetitionStringToClassifier('B').rawgrade).toBe(70);
  expect(convertCompetitionStringToClassifier('D').rawgrade).toBe(110);
});

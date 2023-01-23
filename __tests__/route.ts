import {
  convertBoulderStringToClassifier,
  convertCompetitionStringToClassifier,
  convertLeadclimbStringToClassifier,
  convertTopropeStringToClassifier,
  convertTraverseStringToClassifier,
} from '../api';

test('boulder strings are properly converted to their RouteClassifier', () => {
  expect(convertBoulderStringToClassifier('VB').rawgrade).toBe(-1);
  expect(convertBoulderStringToClassifier('V0').rawgrade).toBe(0);
  expect(convertBoulderStringToClassifier('V1').rawgrade).toBe(1);
});

test('traverse strings are properly converted to their RouteClassifier', () => {
  expect(convertTraverseStringToClassifier('A').rawgrade).toBe(1);
  expect(convertTraverseStringToClassifier('B').rawgrade).toBe(2);
  expect(convertTraverseStringToClassifier('Z').rawgrade).toBe(26);
});

test('toprope strings are properly converted to their RouteClassifier', () => {
  expect(convertTopropeStringToClassifier('5.6-').rawgrade).toBe(59);
  expect(convertTopropeStringToClassifier('5.6').rawgrade).toBe(60);
  expect(convertTopropeStringToClassifier('5.6+').rawgrade).toBe(61);
  expect(convertTopropeStringToClassifier('5.7').rawgrade).toBe(70);
});

test('leadclimb strings are properly converted to their RouteClassifier', () => {
  expect(convertLeadclimbStringToClassifier('5.6-').rawgrade).toBe(59);
  expect(convertLeadclimbStringToClassifier('5.6').rawgrade).toBe(60);
  expect(convertLeadclimbStringToClassifier('5.6+').rawgrade).toBe(61);
  expect(convertLeadclimbStringToClassifier('5.7').rawgrade).toBe(70);
});

test('competition strings are properly converted to their RouteClassifier', () => {
  expect(convertCompetitionStringToClassifier('A').rawgrade).toBe(1);
  expect(convertCompetitionStringToClassifier('B').rawgrade).toBe(2);
  expect(convertCompetitionStringToClassifier('Z').rawgrade).toBe(26);
});

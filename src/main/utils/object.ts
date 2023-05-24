interface ArrayValueObj {
  [key: string]: any[]
}
const defaultKeyComparer = (key1: string, key2: string) => {
  return key1 === key2
}

/**
 * more efficient than objectAssignWithArrayValue
 * @param target 
 * @param source 
 * @returns 
 */
export function objectAssignWithArrayValueSpeciallyForHttpHeadrs(target: ArrayValueObj, source: ArrayValueObj) {
  const targetKeys = Object.keys(target);
  const cpSource = { ...source };
  const sourceKeys = Object.keys(source);
  const lowerCaseSourceKeys = sourceKeys.map(key => key.toLowerCase());
  for (const key of targetKeys) {
    const lowerCaseKey = key.toLowerCase();
    const indexInSource = lowerCaseSourceKeys.indexOf(lowerCaseKey);
    if (indexInSource >= 0) {
      const realKey = sourceKeys[indexInSource];
      const targetValue = target[key];
      const sourceValue = source[realKey];
      const mergedValue = [...targetValue, ...sourceValue];
      const uniqueValue = [...new Set(mergedValue)];

      target[key] = uniqueValue;
      delete cpSource[realKey];
    }
  }

  if (Object.keys(cpSource).length > 0) {
    Object.assign(target, cpSource);
  }

  return target
}

export function objectAssignWithArrayValue(target: ArrayValueObj, source: ArrayValueObj, keyComparer = defaultKeyComparer) {
  const targetKeys = Object.keys(target);
  const cpSource = { ...source };
  const sourceKeys = Object.keys(source);
  for (const key of targetKeys) {
    const sourceKey = sourceKeys.find(sourceKey => keyComparer(key, sourceKey));
    if (!sourceKey) {
      continue;
    }

    const targetValue = target[key];
    const sourceValue = source[sourceKey];
    const mergedValue = [...targetValue, ...sourceValue];
    const uniqueValue = [...new Set(mergedValue)];
    target[key] = uniqueValue;

    delete cpSource[sourceKey];
  }

  if (Object.keys(cpSource).length > 0) {
    Object.assign(target, cpSource);
  }

  return target
}



// This function takes two objects and merges them together.
// If the same key exists in both objects, it will merge the arrays
// and return a unique array of values for that key.
// If the key only exists in one object, it will return the value of that key.
export function simpleObjectAssignWithArrayValue(target: ArrayValueObj, source: ArrayValueObj) {
  const targetKeys = Object.keys(target);
  const sourceKeys = Object.keys(source);
  const allKeys = new Set<string>([...targetKeys, ...sourceKeys]);
  for (const key of allKeys) {
    if (!targetKeys.includes(key)) {
      target[key] = source[key] as any[];
      continue
    }
    const targetValue = target[key];
    const sourceValue = source[key];
    const mergedValue = [...targetValue, ...sourceValue];
    const uniqueValue = [...new Set(mergedValue)];

    target[key] = uniqueValue;
  }

  return target
}


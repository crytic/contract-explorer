import merge from 'ts-deepmerge'

export function deepClone<T>(obj: T): T {
    // Serialize and then deserialize the object for a deep clone.
    return JSON.parse(JSON.stringify(obj));
}

export function deepMerge(...objects: object[]): object{
    // Use ts-deepmerge to merge all subkeys under provided objects.
    return merge(...objects);
}
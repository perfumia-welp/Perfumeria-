/* Types for shared/perfumeSetName.mjs (the storefront imports it from TypeScript). */

export declare const PERFUME_SET_PRODUCT_TYPES: readonly number[]
export declare function isPerfumeSetType(productType: unknown): boolean
export declare function perfumeSetName(name: string): string
export declare function perfumeSetDescription(description: string): string
export declare function displayProductName(name: string, productType: number | null | undefined): string
export declare function displayProductDescription(
  description: string,
  productType: number | null | undefined,
): string

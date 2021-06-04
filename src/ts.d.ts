import 'typescript/lib/tsserverlibrary'

declare module "typescript/lib/tsserverlibrary" {
    export function isVariableLike(node: Node): node is VariableLikeDeclaration;
}

import type * as ts from "typescript/lib/tsserverlibrary"

class DummyInlayHintsPlugin implements ts.server.PluginModule {

    private info?: ts.server.PluginCreateInfo;

    constructor(private readonly typescript: typeof ts) { }

    create(info: ts.server.PluginCreateInfo) {
        this.info = info;

        this.info?.project.projectService.logger.info("[create]")

        const oldProvider = info.languageService.provideInlayHints.bind(info.languageService);
        info.languageService.provideInlayHints = (
            (
                filename,
                span,
                preferences
            ) => {
                const result = oldProvider(filename, span, preferences);
                return result.concat(this.provideInlayHints(info, filename, span))
            }
        )

        return info.languageService;
    }

    provideInlayHints (
        info: ts.server.PluginCreateInfo,
        filename: string,
        span: ts.TextSpan
    ): ts.InlayHint[] {
        const ts = this.typescript
        const { languageService } = info
        const program = languageService.getProgram();

        if (!program) {
            this.info?.project.projectService.logger.info("[No program]")
            return []
        }
        const file = program?.getSourceFile(filename);
        if (!file) {
            this.info?.project.projectService.logger.info("[No file]")
            return []
        }
        const checker = program.getTypeChecker();

        const results: ts.InlayHint[] = []
        visitor(file);
        return results;

        function visitor(node: ts.Node): true | undefined | void {
            if (!node || node.getFullWidth() === 0) {
                return;
            }

            switch (node.kind) {

                case ts.SyntaxKind.ModuleDeclaration:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.ArrowFunction:

                    if (!ts.textSpanIntersectsWith(span, node.pos, node.getFullWidth())) {
                        return;
                    }
            }

            if (ts.isTypeNode(node)) {
                return;
            }

            if (ts.isIdentifier(node) || ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
                visitMaybeReference(node)
                return;
            }

            return ts.forEachChild(node, visitor)
        }

        function visitMaybeReference(node: ts.Identifier | ts.ElementAccessExpression | ts.PropertyAccessExpression) {
            if (ts.isIdentifier(node) && ts.isVariableLike(node.parent) && node.parent.name === node) {
                return;
            }
            const type = checker.getTypeAtLocation(node)
            if (type && type.flags & ts.TypeFlags.Any) {
                results.push({
                    text: 'Hoops! Any!',
                    position: node.end,
                    kind: ts.InlayHintKind.Other,
                    whitespaceBefore: true
                })
                return;
            }

            if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) {
                visitor(node.expression)
            }
        }
    }
}

export = (mod: { typescript: typeof ts }) =>
    new DummyInlayHintsPlugin(mod.typescript);

/** @jsxImportSource reintent-core */
// A third host: a brief the model could read three ways (a story, a product demo, a game), and a
// title and a layout whose choices go together. Each form reads its own intents: what is read
// depends on what was chosen (JSX nesting is the bind).
import { host, scope, useChoice, type Child } from '../src/core/index';
import { Choose } from '../src/lib/choose';
import { shown } from '../src/lib/vocab';

const read = (name: string, kinds: string[], otherwise: string) =>
  shown(useChoice<string>(name, { default: otherwise, kinds }), otherwise);

export const Experience = scope(function Experience(p: { children?: Child }) {
  return host('experience', { children: p.children });
});
Experience.displayName = 'Experience';

export function Title() {
  return host('title', { tone: read('tone', ['playful', 'serious'], 'serious') });
}
Title.displayName = 'Title';

export function Layout() {
  return host('layout', { density: read('density', ['roomy', 'dense'], 'roomy') });
}
Layout.displayName = 'Layout';

export function Storytelling() {
  return host('story', { pace: read('pace', ['slow', 'brisk'], 'slow') });
}
Storytelling.displayName = 'Storytelling';

export function ProductDemo() {
  return host('demo', { depth: read('depth', ['overview', 'walkthrough'], 'overview') });
}
ProductDemo.displayName = 'ProductDemo';

export function InteractiveGame() {
  return host('game', { difficulty: read('difficulty', ['easy', 'hard'], 'easy') });
}
InteractiveGame.displayName = 'InteractiveGame';

export default (
  <Experience key="brief">
    <Title key="title" />
    <Layout key="layout" />
    <Choose
      key="form"
      name="form"
      default="story"
      alternatives={{
        story: <Storytelling key="story" />,
        demo: <ProductDemo key="demo" />,
        game: <InteractiveGame key="game" />,
      }}
    />
  </Experience>
);

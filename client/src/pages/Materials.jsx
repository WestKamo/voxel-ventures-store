import { Link } from 'react-router-dom';
import { Heading } from '../components/UI';
export default function Materials() {
  return (
    <section className="section">
      <Heading eyebrow="KNOW YOUR LAYERS" title="The right material. The right feeling.">
        Tell us how you’ll use your object. We’ll help match form with function.
      </Heading>
      <div className="material-grid">
        {[
          [
            'PLA',
            'The everyday creative',
            'Crisp detail and beautiful finishes for indoor decor, organisers, and prototypes. Avoid high heat.',
          ],
          [
            'PETG',
            'A tougher everyday',
            'A good starting point for practical parts and moisture-exposed uses. Discuss loads and conditions with the studio.',
          ],
          [
            'TPU',
            'A little flexibility',
            'Flexible, resilient material for grips, protective parts, and soft-touch experiments.',
          ],
          [
            'ABS',
            'Built for engineering',
            'An option for more demanding functional prototypes. Enclosed printing and appropriate ventilation are required.',
          ],
          [
            'Resin',
            'All in the detail',
            'Fine features for miniatures and display pieces. Cured parts have material-specific handling and durability limits.',
          ],
        ].map(([name, title, body]) => (
          <article className="panel" key={name}>
            <span className="material-name">{name}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <div className="panel">
        <h2>Let’s get the details right.</h2>
        <p>
          Colours vary with filament batches and screens. Printed parts are not automatically
          food-safe, medical-grade, or suitable for safety-critical loads. Describe your intended
          use so the studio can assess it.
        </p>
        <Link className="button primary" to="/custom">
          Discuss your project →
        </Link>
      </div>
    </section>
  );
}

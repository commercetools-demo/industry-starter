'use client';

import { useState, type ReactNode } from 'react';
import AvailabilityDot from '@/components/ui/AvailabilityDot';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import ColorSwatch from '@/components/ui/ColorSwatch';
import Drawer from '@/components/ui/Drawer';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import Icon, { type IconName } from '@/components/ui/Icon';
import IconButton from '@/components/ui/IconButton';
import { ICONS } from '@/components/ui/icons';
import Modal from '@/components/ui/Modal';
import OptionButton from '@/components/ui/OptionButton';
import Rating from '@/components/ui/Rating';
import Stepper from '@/components/ui/Stepper';
import Steps from '@/components/ui/Steps';
import { ToastProvider, useToast } from '@/context/toast';

const COLOUR_TOKENS = [
  'ink', 'ink-2', 'ink-3', 'canvas', 'canvas-2', 'surface', 'line', 'line-2', 'accent', 'accent-press',
  'teal', 'teal-strong', 'teal-text', 'ct-amber-500', 'ct-danger', 'danger-text', 'stone',
  'footer-heading', 'footer-link', 'footer-meta', 'swatch-black', 'swatch-white', 'swatch-red',
  'swatch-silver', 'swatch-cream',
];
const RADII = ['pill', 'field', 'card', 'panel', 'hero'];
const SWATCH_KEYS = ['black', 'white', 'red', 'silver', 'cream', 'unknown-key'];
const STEPS = [
  { key: 'bag', label: 'Bag' },
  { key: 'details', label: 'Details' },
  { key: 'pay', label: 'Payment' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`sec-${title}`} className="border-t border-line py-10">
      <h2 id={`sec-${title}`} className="section-title mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ToastDemo() {
  const { show } = useToast();
  return <Button onClick={() => show('Added to your bag')}>Show toast</Button>;
}

function Sink() {
  const [chip, setChip] = useState(true);
  const [option, setOption] = useState('250');
  const [swatch, setSwatch] = useState('red');
  const [qty, setQty] = useState(2);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);

  return (
    <main className="wrap pb-24 pt-10">
      <p className="eyebrow">Design system</p>
      <h1 className="page-title mt-2" data-sample="page-title">
        Kitchen sink
      </h1>
      <p className="mt-2 text-ink-2">Dev only. Every token and atom in every state.</p>

      <Section title="Tokens">
        <div className="grid grid-cols-2 gap-3 narrow:grid-cols-4 grid3:grid-cols-6">
          {COLOUR_TOKENS.map((name) => (
            <div key={name} className="text-[12px]">
              <div className="h-12 rounded-field border border-line" style={{ background: `var(--${name})` }} />
              <code className="font-mono">--{name}</code>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          {RADII.map((r) => (
            <div key={r} className="text-[12px]">
              <div
                className="h-14 w-24 border border-line-2 bg-canvas-2"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <code className="font-mono">--radius-{r}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <p className="hero-title" data-sample="hero-title">
          Coffee, roasted for the week
        </p>
        <h2 className="page-title mt-6">Page title sample</h2>
        <p className="eyebrow mt-6" data-sample="eyebrow">
          Eyebrow sample
        </p>
        <p className="wordmark mt-6" data-sample="wordmark">
          MALVA COFFEE
        </p>
        <p className="mt-6">Body text in Roboto at 15px with a 1.55 line height.</p>
        <p className="mt-2 font-mono text-[13px]">Mono: MC-100234 / 3 items</p>
      </Section>

      <Section title="Buttons">
        <Row label="Variants">
          <Button>Ink</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="lg">Large</Button>
          <ButtonLink href="/dev/design" variant="ghost">
            Link styled
          </ButtonLink>
        </Row>
        <Row label="States: disabled, loading">
          <Button disabled>Disabled</Button>
          <Button variant="accent" loading>
            Loading
          </Button>
          <IconButton label="Search" icon="search" />
          <IconButton label="Bag" icon="bag" badgeCount={3} />
        </Row>
        <Row label="Block">
          <div className="w-full max-w-sm">
            <Button block>Block button</Button>
          </div>
        </Row>
      </Section>

      <Section title="Chips">
        <Row label="Default, active (toggle)">
          <Chip>Default</Chip>
          <Chip active={chip} onClick={() => setChip(!chip)}>
            {chip ? 'Active' : 'Inactive'}
          </Chip>
        </Row>
      </Section>

      <Section title="Fields">
        <div className="grid max-w-xl gap-2">
          <Field label="Name" htmlFor="ks-name" hint="As shown on your order">
            <Input id="ks-name" placeholder="Your name" aria-describedby="ks-name-hint" />
          </Field>
          <Field label="Email" htmlFor="ks-email" error="Enter a valid email address">
            <Input id="ks-email" invalid defaultValue="nobody" aria-describedby="ks-email-error" />
          </Field>
          <Field label="Search" htmlFor="ks-search">
            <Input id="ks-search" shape="pill" placeholder="Search beans" />
          </Field>
          <Field label="Grind" htmlFor="ks-grind">
            <Select id="ks-grind" defaultValue="whole">
              <option value="whole">Whole bean</option>
              <option value="filter">Filter</option>
            </Select>
          </Field>
          <Field label="Note" htmlFor="ks-note">
            <Textarea id="ks-note" placeholder="Anything we should know" />
          </Field>
        </div>
      </Section>

      <Section title="Options">
        <Row label="Selected, default, disabled with reason">
          {['250', '500'].map((size) => (
            <OptionButton key={size} selected={option === size} onClick={() => setOption(size)}>
              {size} g
            </OptionButton>
          ))}
          <OptionButton disabled disabledReason="Not available for collection" data-sample="disabled-option">
            1 kg
          </OptionButton>
        </Row>
      </Section>

      <Section title="Swatches">
        <Row label="Small (cards)">
          {SWATCH_KEYS.map((key) => (
            <ColorSwatch key={key} colour={key} label={key} />
          ))}
        </Row>
        <Row label="Large, selectable">
          {SWATCH_KEYS.map((key) => (
            <ColorSwatch key={key} colour={key} label={key} size="lg" selected={swatch === key} onSelect={() => setSwatch(key)} />
          ))}
        </Row>
      </Section>

      <Section title="Stepper">
        <Row label="Min 1, max 5">
          <Stepper label="Quantity" value={qty} min={1} max={5} onChange={setQty} />
          <Stepper label="Quantity (disabled)" value={1} onChange={setQty} disabled />
        </Row>
      </Section>

      <Section title="Cards and badges">
        <div className="grid max-w-xl gap-4">
          <Card>
            <div className="mb-3 flex gap-2">
              <Badge>Bestseller</Badge>
              <Badge variant="accent">New</Badge>
            </div>
            <p className="m-0">A card: surface, 1px line, 16px radius, 24px padding.</p>
          </Card>
        </div>
      </Section>

      <Section title="Availability and rating">
        <Row label="Availability dots with labels">
          <span className="flex items-center gap-2">
            <AvailabilityDot state="in" label="In stock" /> In stock
          </span>
          <span className="flex items-center gap-2">
            <AvailabilityDot state="low" label="Low stock" /> Low stock
          </span>
          <span className="flex items-center gap-2">
            <AvailabilityDot state="out" label="Out of stock" /> Out of stock
          </span>
        </Row>
        <Row label="Rating">
          <Rating value={4.58333} count={12} />
          <Rating value={4} count={1234} small />
          <Rating value={0} count={0} />
        </Row>
      </Section>

      <Section title="Drawer">
        <Button onClick={() => setDrawer(true)}>Open drawer</Button>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Your bag" footer={<Button block>Checkout</Button>}>
          <p>Drawer body. Tab stays inside; Escape closes.</p>
          <Button variant="ghost">Inside action</Button>
        </Drawer>
      </Section>

      <Section title="Modal">
        <Button variant="ghost" onClick={() => setModal(true)}>
          Open modal
        </Button>
        <Modal open={modal} onClose={() => setModal(false)} title="Choose a store">
          <p>Modal body, 560px wide with a 24px radius.</p>
          <Button onClick={() => setModal(false)}>Done</Button>
        </Modal>
      </Section>

      <Section title="Toast">
        <ToastDemo />
      </Section>

      <Section title="Steps">
        <div className="grid gap-6">
          <Steps steps={STEPS} current="bag" />
          <Steps steps={STEPS} current="details" />
          <Steps steps={STEPS} current="pay" />
        </div>
      </Section>

      <Section title="Icons">
        <div className="grid grid-cols-3 gap-4 narrow:grid-cols-6 grid3:grid-cols-8">
          {(Object.keys(ICONS) as IconName[]).map((name) => (
            <div key={name} className="flex flex-col items-center gap-2 rounded-field border border-line p-3 text-[12px]">
              <div className="flex items-end gap-3">
                <Icon name={name} size={24} />
                <Icon name={name} size={96} />
              </div>
              <code className="font-mono">{name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Grid">
        <div className="grid-products" data-sample="grid-products">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[4/5] rounded-card bg-canvas-2 p-4 text-[12px] text-ink-2">
              Card {i + 1}
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

export default function KitchenSink() {
  return (
    <ToastProvider>
      <Sink />
    </ToastProvider>
  );
}

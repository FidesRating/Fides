import Link from 'next/link';
import TakedownForm from './TakedownForm';

export default function EthicsPage() {
  return (
    <>
      <section className="box ph">
        <div className="l">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Ethics</span></nav>
          <span className="eyebrow chip">ETHICS</span>
          <h1>Fair to the rated, <em>useful to the reader.</em></h1>
        </div>
        <div className="r">
          <p className="sub">FIDES rates people, so the biggest risks are a wrong accusation and doxxing. These rules apply to every rating and are enforced on the server, including for accounts with low ratings.</p>
        </div>
      </section>
      <section className="box split">
        <div className="panel">
          <span className="idx">01 / WHO CAN BE RATED</span>
          <ul className="list-dot">
            <li><span><b>Public accounts only</b>, with at least 10,000 followers, that regularly recommend tokens.</span></li>
            <li><span>Private accounts, small accounts and people who do not act as influencers are not rated. If one is included by mistake, it is removed completely.</span></li>
            <li><span>We rate the account's public conduct, never the person's private life.</span></li>
          </ul>
        </div>
        <div className="panel">
          <span className="idx">02 / RIGHT OF REPLY</span>
          <ul className="list-dot">
            <li><span>Every rating action is notified 48 hours before publication, through the claimed profile or a mention on X.</span></li>
            <li><span>Claimed accounts can publish a reply on the rating page, add wallets with a signature and appeal.</span></li>
            <li><span>Evidence used to lower a rating is shown on the rating page so anyone can check it.</span></li>
            <li><span>Tips from holders never change a rating directly. They go to the analyst queue and are used only once proven.</span></li>
          </ul>
        </div>
      </section>
      <section className="box">
        <div className="secbar"><h3>03 / Data we use, and data we never use</h3></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th scope="col" style={{ width: '50%' }}>Used</th><th scope="col">Never used</th></tr></thead>
            <tbody>
              <tr><td className="wrap" style={{ fontFamily: 'var(--sans)' }}>The account's own public posts, with an archive as proof</td><td className="wrap">Personal data: real name (unless the account uses it publicly), address, family, workplace</td></tr>
              <tr><td className="wrap" style={{ fontFamily: 'var(--sans)' }}>On-chain and exchange token prices at the time of the call</td><td className="wrap">Guessing or linking wallets to an account through cluster analysis</td></tr>
              <tr><td className="wrap" style={{ fontFamily: 'var(--sans)' }}>Wallets the account declared in a public post or proved with a signature</td><td className="wrap">Wallets "believed" to belong to someone</td></tr>
              <tr><td className="wrap" style={{ fontFamily: 'var(--sans)' }}>A project's own statement, public invoices, or on-chain payments to a declared wallet</td><td className="wrap">Private messages, leaked data, screenshots that cannot be verified</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="box split">
        <div className="panel">
          <span className="idx">04 / LANGUAGE AND DISCLAIMER</span>
          <p>A rating is an opinion based on a published methodology, not a statement of fact about anyone's intent. We write "proven undisclosed", never "scammer".</p>
          <p>D is used only when the evidence is complete: a proven paid promotion, not disclosed, and a sale from a wallet the account declared itself.</p>
          <div className="reply" style={{ fontSize: '13.5px' }}>FIDES ratings are opinions based on public data and a published methodology. They are not statements of fact, not regulated credit ratings, and not investment advice.</div>
        </div>
        <div className="panel" id="takedown">
          <span className="idx">05 / TAKEDOWN REQUEST</span>
          <p>For accounts that do not meet the coverage rules. A removed account disappears from every public page and from the sitemap.</p>
          <TakedownForm />
        </div>
      </section>
    </>
  );
}

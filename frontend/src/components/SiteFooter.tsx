export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__copyright">© {new Date().getFullYear()} Inquire Capitalism</p>
      <p className="site-footer__credit">
        Historic image courtesy of the University of Florida Digital Collections, University Libraries.
      </p>
    </footer>
  )
}

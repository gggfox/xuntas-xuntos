import * as m from '../../paraglide/messages.js'

/**
 * What a coach, finance or health account sees today. They can be invited
 * now — the point of master_admin this cycle is onboarding staff — and this
 * page is what makes that invitation land somewhere honest.
 */
export default function NoTools() {
  return (
    <div className="card mt-8 max-w-[62ch] px-[21px] py-[19px]">
      <b className="mb-1 block font-disp text-[15px]">{m.admin_no_tools_title()}</b>
      <p className="m-0 text-[13px] font-light text-soft">{m.admin_no_tools_text()}</p>
    </div>
  )
}

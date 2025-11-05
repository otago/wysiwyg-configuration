/* Keep CMS preview in "content" mode and unhide the LinkType field in the link dialog.
   Ported from app/javascript/MyLeftAndMain.Preview.js
*/
(function ($) {
    $('.cms-preview').entwine('.ss.preview').changeMode('content');

    // Unhide the LinkType optionset (workaround for template that hides it)
    $.entwine('ss', function ($) {
        $('form.htmleditorfield-linkform').entwine({
            redraw: function () {
                this._super();
                this.find('#Form_EditorToolbarLinkForm_LinkType_Holder').show();
            }
        });
    });
})(jQuery);
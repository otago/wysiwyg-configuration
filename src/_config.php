<?php

use SilverStripe\Core\Environment;
use SilverStripe\Forms\HTMLEditor\TinyMCEConfig;

// Apply to the default CMS editor profile
$editor = TinyMCEConfig::get('cms');

// Build valid elements (whitespace stripped, as in the original)
$validElements = preg_replace('/\s+/', '', '@[id|class|style],
    a[href|target|rel|title|class|style],
    b,
    strong,
    em,
    i,
    u,
    p[class|style],
    br,
    span[class|style],
    div[class|style],
    ul[class|style], ol[class|style], li[class|style],
    table[border|cellspacing|cellpadding|width|height|class|style],
    thead[class|style], tbody[class|style], tfoot[class|style],
    tr[class|style],
    td[colspan|rowspan|width|height|align|valign|class|style],
    th[colspan|rowspan|width|height|align|valign|class|style],
    img[src|alt|title|width|height|class|style],
    h1[class|style], h2[class|style], h3[class|style], h4[class|style], h5[class|style], h6[class|style]
');

// Allow env override for images upload endpoint; fallback to your previous default
$imagesUploadUrl = Environment::getEnv('WYSIWYG_IMAGE_UPLOAD_URL') ?: '/tuhonoupload';

// Editor options (paste behaviour, valid elements, upload URL, etc.)
$editor->setOptions([
    'paste_as_text' => false,
    'paste_data_images' => true,
    'images_upload_url' => $imagesUploadUrl, // also used on front-end if integrated
    'paste_remove_styles_if_webkit' => false,
    'forced_root_block' => 'p',
    'paste_webkit_styles' => 'font-weight font-style text-decoration', // keep bold/italic/underline
    'valid_elements' => $validElements,
]);

// Enable your custom paste cleaner plugin (registered globally via JS) + fullscreen
$editor->enablePlugins([
    'custom_paste_cleaner' => 'custom_paste_cleaner', // plugin is registered in client/js/custom_paste_cleaner.js
]);
$editor->enablePlugins('fullscreen');

// Toolbar/buttons (match your previous layout)
$editor->addButtonsToLine(1, 'blockquote');
$editor->addButtonsToLine(1, 'hr');
$editor->removeButtons('blocks');

// Table class presets
$editor->setOption('table_class_list', [
    ['title' => 'Original', 'value' => ''],
    ['title' => 'No Styles', 'value' => 'table_no_styles'],
    ['title' => 'Default', 'value' => 'table_2021'],
    ['title' => 'Datatable (Default)', 'value' => 'table_2021 datatable__default'],
    ['title' => 'Datatable (Sortable only)', 'value' => 'table_2021 datatable__sortable'],
]);

// Import CSS groups (left like-for-like with your "All styles" group)
$editor->setOption('importcss_groups', [
    ['title' => 'All styles', 'filter' => ''],
]);

// Style formats (headings, spacing utilities, and anchor-as-button styles)
$formats = [
    [
        'title' => 'Headings',
        'items' => [
            ['title' => 'Paragraph', 'format' => 'p'],
            ['title' => 'Heading 1', 'format' => 'h1'],
            ['title' => 'Heading 2', 'format' => 'h2'],
            ['title' => 'Heading 3', 'format' => 'h3'],
            ['title' => 'Heading 4', 'format' => 'h4'],
            ['title' => 'Heading 5', 'format' => 'h5'],
            ['title' => 'Heading 6', 'format' => 'h6'],
            ['title' => 'Preformatted', 'format' => 'pre'],
        ],
    ],
    [
        'title' => 'Padding',
        'items' => [
            ['title' => 'padding top 0',      'classes' => 'padding--top-0',        'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'padding top 25',     'classes' => 'padding--top-25',       'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'padding bottom 2',   'classes' => 'padding--bottom-12-5',  'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'padding vertical 2', 'classes' => 'padding--vertical-12-5', 'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'margin--top-0',      'classes' => 'margin--top-0',         'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'margin--top-12-5',   'classes' => 'margin--top-12-5',      'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'margin--top-25',     'classes' => 'margin--top-25',        'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'margin--bottom-12-5', 'classes' => 'margin--bottom-12-5',   'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'margin--vertical-12-5', 'classes' => 'margin--vertical-12-5', 'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
            ['title' => 'margin--vertical-25px', 'classes' => 'margin--vertical-25px', 'selector' => 'a,p,span,h1,h2,h3,h4,h5'],
        ],
    ],
    [
        'title' => 'Buttons (anchors only)',
        'items' => [
            ['title' => 'Button',          'selector' => 'a', 'classes' => 'btn'],
            ['title' => 'Primary Button',  'selector' => 'a', 'classes' => 'btn btn__primary'],
            ['title' => 'Chevron',         'selector' => 'a', 'classes' => 'btn btn__solid-chevron'],
        ],
    ],
];

// Merge formats and additional options, and set the secondary toolbar
$editor
    ->addButtonsToLine(2, 'styles')
    ->setOptions([
        'importcss_append' => true,
        'style_formats' => $formats,
        'importcss_merge_classes' => false,
    ]);

$editor->setButtonsForLine(2, [
    'styles',
    '|',
    'pastetext',
    '|',
    'table',
    'ssmedia',
    'ssembed',
    'sslink',
    'anchor',
    'unlink',
    '|',
    'code',
    'visualblocks',
]);

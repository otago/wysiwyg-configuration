<?php

/**
 * Otago WYSIWYG Paste Cleaner Module
 *
 * This module now only provides an Entwine-based JavaScript paste cleaner for TinyMCE.
 * No PHP configuration is required because the cleaner attaches directly via Entwine.
 *
 * If you previously had TinyMCE plugin registration or toolbar options here, remove them.
 * Example of what to remove:
 *   $editor = \SilverStripe\Forms\HTMLEditor\TinyMCEConfig::get('cms');
 *   $editor->enablePlugins(['custom_paste_cleaner' => 'custom_paste_cleaner']);
 *
 * All paste cleaning logic now lives in:
 *   client/js/custom_paste_cleaner.js
 */

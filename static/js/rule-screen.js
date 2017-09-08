/**
 * Rule Screen.
 *
 * Allows editing a single rule
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global API, DevicePropertyBlock, Gateway, Rule, RuleUtils, page */

'use strict';

// eslint-disable-next-line no-unused-vars
const RuleScreen = {
  init: function() {
    this.gateway = new Gateway();

    this.rule = null;

    this.ruleArea = document.getElementById('rule-area');
    this.ruleName = document.querySelector('.rule-name');
    this.ruleNameCustomize = document.querySelector('.rule-name-customize');
    this.ruleNameCustomize.addEventListener('click', () => {
      // Select all of ruleName, https://stackoverflow.com/questions/6139107/
      let range = document.createRange();
      range.selectNodeContents(this.ruleName);
      let selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });

    this.ruleName.contentEditable = true;
    this.ruleName.addEventListener('blur', () => {
      this.rule.name = this.ruleName.textContent;
      this.rule.update();
    });
    this.ruleDescription = document.querySelector('.rule-info > p');

    this.devicesList = document.getElementById('devices-list');
    this.onboardingHint = document.getElementById('onboarding-hint');
    this.connection = document.getElementById('connection');

    this.deleteOverlay = document.getElementById('rule-delete-overlay');
    this.deleteButton = document.getElementById('delete-button');
    this.deleteCancel = document.querySelector('.rule-delete-cancel-button');
    this.deleteConfirm = document.querySelector('.rule-delete-confirm-button');

    this.deleteButton.addEventListener('click', () => {
      this.deleteOverlay.classList.add('active');
    });

    this.deleteCancel.addEventListener('click', () => {
      this.deleteOverlay.classList.remove('active');
    });

    this.deleteConfirm.addEventListener('click', () => {
      this.rule.delete().then(function() {
        page('/rules');
      });
    });

  },

  /**
   * Instantiate a draggable DevicePropertyBlock from a template DeviceBlock in
   * the palette
   * @param {ThingDescription} thing
   * @param {Event} event
   */
  onDeviceBlockDown: function(thing, event) {
    if (!this.rule) {
      return;
    }
    let deviceRect = event.target.getBoundingClientRect();

    let x = deviceRect.left;
    let y = deviceRect.top;
    let newBlock = new DevicePropertyBlock(this.ruleArea, this.rule, thing,
      x, y);

    newBlock.draggable.onDown(event);
  },

  /**
   * Create a device-block from a thing
   * @param {ThingDescription} thing
   * @return {Element}
   */
  makeDeviceBlock: function(thing) {
    let elt = document.createElement('div');
    elt.classList.add('device');

    elt.innerHTML = `<div class="device-block">
      <img class="device-icon" src="/rules-engine/images/onoff.svg" width="48px"
           height="48px"/>
    </div>
    <p>${thing.name}</p>`;

    return elt;
  },

  /**
   * Instantiate a DevicePropertyBlock
   * @param {'trigger'|'effect'} role
   * @param {number} x
   * @param {number} y
   */
  makeDevicePropertyBlock: function(role, x, y) {
    let thing = this.gateway.things.filter(
      RuleUtils.byProperty(this.rule[role].property)
    )[0];
    let block = new DevicePropertyBlock(this.ruleArea, this.rule, thing, x, y);
    let rulePart = {};
    rulePart[role] = this.rule[role];
    block.setRulePart(rulePart);
  },

  showConnection: function() {
    this.connection.classList.remove('hidden');

    let triggerBlock =
      document.querySelector('.device-block.trigger').parentNode;
    let effectBlock = document.querySelector('.device-block.effect').parentNode;
    function transformToCoords(elt) {
      let re = /translate\((\d+)px, +(\d+)px\)/;
      let matches = elt.style.transform.match(re);
      let x = parseFloat(matches[1]);
      let y = parseFloat(matches[2]);
      return {
        x: x,
        y: y
      };
    }
    let triggerCoords = transformToCoords(triggerBlock);
    let effectCoords = transformToCoords(effectBlock);

    let startX = triggerCoords.x + 310;
    let startY = triggerCoords.y + 50;
    let endX = effectCoords.x - 10;
    let endY = effectCoords.y + 50;

    let midX = (startX + endX) / 2;

    let pathDesc  = [
      'M', startX, startY,
      'C', midX, startY, midX, endY, endX, endY
    ].join(' ');

    let path = this.connection.querySelector('path');
    path.setAttribute('d', pathDesc);
    let circleTrigger = this.connection.querySelector('.trigger');
    circleTrigger.setAttribute('cx', startX);
    circleTrigger.setAttribute('cy', startY);
    let circleEffect = this.connection.querySelector('.effect');
    circleEffect.setAttribute('cx', endX);
    circleEffect.setAttribute('cy', endY);
  },

  hideConnection: function() {
    this.connection.classList.add('hidden');
  },

  onRuleUpdate: function() {
    this.ruleName.textContent = this.rule.name || 'Rule Name';
    this.ruleDescription.textContent = this.rule.toHumanDescription();
    if (this.rule.trigger && this.rule.effect &&
      !document.querySelector('.dragging')) {
      this.showConnection();
    } else {
      this.hideConnection();
    }

    if (!document.querySelector('.device-property-block')) {
      this.onboardingHint.classList.remove('hidden');
    } else {
      this.onboardingHint.classList.add('hidden');
    }
  },

  show: function(ruleId) {
    // Fetch the rule description from the Engine or default to null
    let rulePromise = Promise.resolve(null);
    if (ruleId !== 'new') {
      rulePromise = fetch('/rules-engine/rules/' + ruleId, {
        headers: API.headers()
      }).then(function(res) {
        return res.json();
      });
    }

    this.gateway.readThings().then(things => {
      for (let thing of things) {
        let elt = this.makeDeviceBlock(thing);
        elt.addEventListener('mousedown',
          this.onDeviceBlockDown.bind(this, thing));
        this.devicesList.appendChild(elt);
      }
    }).then(function() {
      return rulePromise;
    }).then(ruleDesc => {
      this.rule = new Rule(this.gateway, ruleDesc,
        this.onRuleUpdate.bind(this));
      if (ruleDesc) {
        let areaRect = this.ruleArea.getBoundingClientRect();
        // Create DevicePropertyBlocks from trigger and effect if applicable
        if (ruleDesc.trigger) {
          this.makeDevicePropertyBlock('trigger', 20,
            areaRect.height / 2);
        }
        if (ruleDesc.effect) {
          this.makeDevicePropertyBlock('effect', areaRect.width - 320,
            areaRect.height / 2);
        }
      }
      this.onRuleUpdate();
    });
  }
};
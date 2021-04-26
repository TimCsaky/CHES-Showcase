<template>
  <v-container class="pa-0 mt-10">
    <v-form ref="form" :disabled="formDisabled" lazy-validation>
      <v-row>
        <v-col cols="12" md="6" class="disabled-input-container">
          <label>Sender</label>
          <v-text-field
            v-model="currentUserEmail"
            hide-details="auto"
            readonly
            outlined
            dense
          ></v-text-field>
        </v-col>
      </v-row>

      <v-row>
        <!-- subject -->
        <v-col cols="12" md="12">
          <label>Subject (optional)</label>
          <v-text-field
            v-model="form.subject"
            :rules="[v => !!v || 'Subject is required']"
            hide-details="auto"
            outlined
            dense
          ></v-text-field>
        </v-col>
      </v-row>

      <v-row>
        <!-- context format -->
        <v-col cols="12" md="12" class="pb-0">
          <div class="d-flex">
            <label class="mt-1">Contexts</label>
            <v-radio-group
              v-model="form.contextFormat"
              class="mt-0 ml-5 d-flex"
              hide-details="auto"
            >
              <v-radio class="" label="Excel" value="excel"></v-radio>
              <v-radio class="" label="JSON" value="json"></v-radio>
            </v-radio-group>
          </div>
        </v-col>
      </v-row>
      <v-row>
        <!-- contexts -->
        <v-col cols="12" md="12" class="pb-0">
          <div
            ref="dropZone"
            @drop.prevent="addFiles($event)"
            @click="fileInputBrowse()"
            @dragover.prevent="dragover = true"
            @dragenter.prevent="dragover = true"
            @dragleave.prevent="dragover = false"
            :class="['contexst-drop-zone', { 'grey lighten-2': dragover }]"
          >
          </div>

          <v-container>
            <v-row
              v-if="contextFiles.length < 1"
              class="d-flex flex-column"
              dense
              align="center"
              justify="center"
            >
              <p class="">Drag &amp; Drop your file(s) here, or click to Browse.</p>
            </v-row>

            <div v-if="files.length > 0">
              <v-row v-for="file in files" v-bind:key="file.name">
                <slot name="file" v-bind:file="file">
                  <v-col sm="10">
                    <v-icon>article</v-icon>
                    {{ file.name }}
                    <span class="text--secondary">({{ file.size }} bytes)</span>
                  </v-col>
                  <v-col sm="2">
                    <v-btn
                      @click.stop="removeFile(file.name)"
                      icon
                      class="float-right"
                    >
                      <v-icon> mdi-close-circle </v-icon>
                    </v-btn>
                  </v-col>
                </slot>
              </v-row>
            </div>
          </v-container>

        </v-col>
      </v-row>



      <v-row>
        <!-- body format -->
        <v-col cols="12" md="12" class="pb-0">
          <div class="d-flex">
            <label class="mt-1">Body</label>
            <v-radio-group
              v-model="form.bodyFormat"
              class="mt-0 ml-5 d-flex"
              hide-details="auto"
            >
              <v-radio class="" label="Plain Text" value="text"></v-radio>
              <v-radio class="" label="HTML" value="html"></v-radio>
            </v-radio-group>
          </div>
        </v-col>
      </v-row>

      <v-row>
        <!-- body -->
        <v-col cols="12" :md="variables.length > 0 ? 8 : 12" class="bodyDiv">
          <v-textarea
            v-if="form.bodyFormat === 'text'"
            v-model="form.body"
            :rules="bodyRequiredRule"
            hide-details="auto"
            outlined
            dense
            value="Enter your email body here."
            class="mb-3"
          ></v-textarea>
          <ckeditor
            v-else
            :editor="editor"
            v-model="form.body"
            :config="editorConfig"
          ></ckeditor>
        </v-col>
        <!-- variables -->
        <v-col v-if="variables.length > 0" cols="12" md="4" class="variablesDiv">
        </v-col>


      </v-row>

      <v-row>
        <!-- Attachments -->
        <v-col cols="12" md="12">
          <label>Attachments (optional)</label>
          <Upload
            @filesUploaded="processAttachments($event)"
            :fileCount="form.attachments.length"
            class="my-3 py-3"
          />
        </v-col>
      </v-row>

      <v-row justify="center" class="my-10">
        <v-col md="4">
          <v-btn width="100%" large color="primary" @click="send()">
            <span>Send</span>
          </v-btn>
        </v-col>
        <v-col md="4">
          <v-btn width="100%" large outlined @click="reloadForm">
            <span>Cancel</span>
          </v-btn>
        </v-col>
      </v-row>
    </v-form>
  </v-container>
</template>

<script>
import { mapActions } from 'vuex';

import Upload from '@/components/ches/Upload';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';

// import chesService from '@/services/chesService';
import { Regex } from '../../utils/constants';

export default {
  name: 'MergeForm',
  components: {
    Upload,
  },
  data: () => ({
    // form fields
    form: {
      attachments: [],
      body: '',
      bodyFormat: 'text',
      recipients: [],
      subject: '',

      contexts: '',
      contextFormat: 'excel',
      contextsType: 'xlsx',
      contextFiles: []
    },

    // for display helpers
    variables: [1, 2, 3],
    formDisabled: false,
    editor: ClassicEditor,
    editorConfig: {
      toolbar: {
        items: [
          'heading',
          '|',
          'bold',
          'italic',
          'link',
          'bulletedList',
          'numberedList',
          'blockQuote',
        ],
      },
    },

    // at least one email required in combobox
    emailRequiredRule: [
      (v) => v.length > 0 || 'Please enter at least 1 email address',
    ],
    // emails in combobox must be valid
    emailArrayRules: [
      (v) =>
        v.every((item) => new RegExp(Regex.EMAIL).test(item)) ||
        'Please enter all valid email addresses',
    ],
    bodyRequiredRule: [(v) => !!v || 'Email Body is required'],
  }),

  computed: {
    // get current users email from auth vuex module
    currentUserEmail() {
      return this.$store.getters['auth/email'];
    },
  },

  methods: {
    ...mapActions('alert', ['showAlert', 'clearAlert']),
    ...mapActions('ches', ['addTransaction']),

    async send() {
      if (this.$refs.form.validate()) {
        try {
          // create email object
          // const email = {
          //   body: this.form.body ,
          //   bodyType: this.form.bodyFormat,
          //   from: this.currentUserEmail,
          //   subject: this.form.subject,
          //   to: this.form.recipients,
          // };
          // // send email with ches service
          // const { data } = await chesService.email(email);
          // // show success alert
          // this.showAlert({
          //   type: 'success',
          //   text:
          //     `<strong>Your email has been successfully sent.<br />Transaction ID: </strong>${data.txId} <strong>Message ID: </strong> ${data.messages[0].msgId}`,
          // });
          // // update store
          // this.addTransaction(data);
          // this.reloadForm();
        } catch (e) {
          // this.error = true;
          // // show error alert
          // this.showAlert({
          //   type: 'error',
          //   text: e,
          // });
        }
      } else {
        // else form has validation error
        window.scrollTo(0, 0);
      }
    },

    async processAttachments(files) {
      const attachments = await Promise.all(
        files.map((file) => this.convertFileToAttachment(file))
      );
      this.form.attachments = attachments;
    },

    async convertFileToAttachment(file) {
      const content = await this.fileToBase64(file);
      return {
        content: content,
        contentType: file.type,
        filename: file.name,
        encoding: 'base64',
      };
    },

    async fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.replace(/^.*,/, ''));
        reader.onerror = (error) => reject(error);
      });
    },

    reloadForm() {
      this.$refs.form.resetValidation();

      this.form = {
        attachments: [],
        body: '',
        bodyFormat: 'text',
        recipients: [],
        subject: '',
      };
      window.scrollTo(0, 0);
    },
  },
  mounted() {
    this.clearAlert();
  },
};
</script>

<style scoped lang="scss">
.disabled-input-container ::v-deep .v-input {
  background-color: #f2f2f2;
}
/* select text was getting cut off at the bottom */
.v-select ::v-deep .v-select__selections {
  line-height: 22px;
}
/* make radio buttons inline */
.v-input--radio-group ::v-deep .v-input--radio-group__input {
  flex-direction: row !important;
}
.v-input--radio-group ::v-deep .v-input--radio-group__input > div {
  margin-bottom: 0 !important;
  margin-left: 2rem;
}
/* give wysiwyg editor a min height */
.bodyDiv ::v-deep .ck-editor__editable {
  min-height: 180px;
}
</style>
